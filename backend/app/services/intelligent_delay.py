"""
Apollo A.I. Advanced - Intelligent Delay Service
=================================================

Provides configurable delay functionality for:
1. Campaign message throttling (anti-ban)
2. Reengagement timing
3. Sequential template content spacing

Returns a Promise that resolves after the delay period.
Maximum delay: 50 seconds (configurable).
"""

import asyncio
import random
from typing import Optional, Callable, Any
from dataclasses import dataclass
from enum import Enum
import structlog

logger = structlog.get_logger()


class DelayStrategy(str, Enum):
    """Strategies for calculating delay duration."""
    FIXED = "fixed"           # Exactly the specified duration
    RANDOM_RANGE = "random"   # Random between min and max
    PROGRESSIVE = "progressive"  # Increases with each call
    ADAPTIVE = "adaptive"     # Based on external signals (rate limits)


@dataclass
class DelayConfig:
    """Configuration for delay behavior."""
    min_seconds: float = 5.0
    max_seconds: float = 50.0
    strategy: DelayStrategy = DelayStrategy.RANDOM_RANGE
    jitter_percent: float = 10.0  # Add randomness to fixed delays
    
    def validate(self) -> bool:
        """Validate configuration."""
        if self.max_seconds > 50.0:
            raise ValueError("Maximum delay cannot exceed 50 seconds")
        if self.min_seconds < 0:
            raise ValueError("Minimum delay cannot be negative")
        if self.min_seconds > self.max_seconds:
            raise ValueError("Minimum delay cannot exceed maximum")
        return True


@dataclass
class DelayResult:
    """Result of a completed delay."""
    delay_id: str
    actual_duration_seconds: float
    strategy_used: str
    was_cancelled: bool = False


class IntelligentDelayService:
    """
    Async delay service that returns promises.
    
    Usage:
        delay_service = IntelligentDelayService()
        
        # Simple random delay (returns after completion)
        await delay_service.delay(min_seconds=10, max_seconds=30)
        
        # With callback
        await delay_service.delay_then(
            min_seconds=10,
            callback=send_message,
            message_id="123"
        )
        
        # Progressive delay for campaign batches
        for i in range(10):
            await delay_service.delay(
                min_seconds=20,
                max_seconds=50,
                strategy=DelayStrategy.PROGRESSIVE,
                delay_id=f"batch_{i}"
            )
    """
    
    MAX_DELAY_SECONDS = 50.0  # Hard limit as per requirement
    
    def __init__(self, default_config: Optional[DelayConfig] = None):
        self.default_config = default_config or DelayConfig()
        self._active_delays: dict[str, asyncio.Task] = {}
        self._progressive_counter: dict[str, int] = {}
        self._rate_limit_signals: dict[str, float] = {}
    
    async def delay(
        self,
        min_seconds: float = None,
        max_seconds: float = None,
        strategy: DelayStrategy = None,
        delay_id: str = None,
    ) -> DelayResult:
        """
        Execute delay and return result.
        
        Args:
            min_seconds: Minimum delay (default from config)
            max_seconds: Maximum delay (capped at 50s)
            strategy: Delay calculation strategy
            delay_id: Optional ID for tracking/cancellation
            
        Returns:
            DelayResult with actual duration and metadata
        """
        min_s = min_seconds if min_seconds is not None else self.default_config.min_seconds
        max_s = min(
            max_seconds if max_seconds is not None else self.default_config.max_seconds,
            self.MAX_DELAY_SECONDS
        )
        strat = strategy or self.default_config.strategy
        
        # Generate delay_id if not provided
        if not delay_id:
            delay_id = f"delay_{id(asyncio.current_task())}_{random.randint(1000, 9999)}"
        
        # Calculate delay based on strategy
        delay_seconds = self._calculate_delay(min_s, max_s, strat, delay_id)
        
        logger.debug(
            "Delay started",
            delay_id=delay_id,
            duration=delay_seconds,
            strategy=strat.value
        )
        
        # Create cancelable task
        task = asyncio.current_task()
        if task and delay_id:
            self._active_delays[delay_id] = task
        
        try:
            await asyncio.sleep(delay_seconds)
            return DelayResult(
                delay_id=delay_id,
                actual_duration_seconds=delay_seconds,
                strategy_used=strat.value,
                was_cancelled=False
            )
        except asyncio.CancelledError:
            logger.info("Delay cancelled", delay_id=delay_id)
            return DelayResult(
                delay_id=delay_id,
                actual_duration_seconds=0,
                strategy_used=strat.value,
                was_cancelled=True
            )
        finally:
            if delay_id and delay_id in self._active_delays:
                del self._active_delays[delay_id]
    
    async def delay_then(
        self,
        callback: Callable[..., Any],
        min_seconds: float = None,
        max_seconds: float = None,
        strategy: DelayStrategy = None,
        delay_id: str = None,
        **callback_kwargs
    ) -> Any:
        """
        Execute delay then call the provided callback.
        
        Args:
            callback: Async function to call after delay
            callback_kwargs: Arguments to pass to callback
            
        Returns:
            Result of the callback function
        """
        result = await self.delay(min_seconds, max_seconds, strategy, delay_id)
        
        if result.was_cancelled:
            return None
        
        # Call callback (handle both sync and async)
        if asyncio.iscoroutinefunction(callback):
            return await callback(**callback_kwargs)
        else:
            return callback(**callback_kwargs)
    
    def _calculate_delay(
        self,
        min_s: float,
        max_s: float,
        strategy: DelayStrategy,
        delay_id: str
    ) -> float:
        """Calculate delay duration based on strategy."""
        if strategy == DelayStrategy.FIXED:
            base = min_s
            jitter = base * (self.default_config.jitter_percent / 100)
            return max(0, base + random.uniform(-jitter, jitter))
        
        elif strategy == DelayStrategy.RANDOM_RANGE:
            return random.uniform(min_s, max_s)
        
        elif strategy == DelayStrategy.PROGRESSIVE:
            # Increase delay with each call for same prefix
            prefix = delay_id.rsplit("_", 1)[0] if "_" in delay_id else delay_id
            count = self._progressive_counter.get(prefix, 0)
            self._progressive_counter[prefix] = count + 1
            
            # Progressive increase: start at min, approach max
            progress = min(count / 10, 1.0)  # Reaches max after 10 calls
            base = min_s + (max_s - min_s) * progress
            
            # Add small jitter
            jitter = base * 0.1
            return min(base + random.uniform(-jitter, jitter), max_s)
        
        elif strategy == DelayStrategy.ADAPTIVE:
            # Check for rate limit signals
            signal = self._rate_limit_signals.get(delay_id, 1.0)
            
            # Multiply delay by signal (1.0 = normal, 2.0 = double delay)
            base = random.uniform(min_s, max_s)
            return min(base * signal, max_s)
        
        return random.uniform(min_s, max_s)
    
    async def cancel_delay(self, delay_id: str) -> bool:
        """Cancel an active delay by ID."""
        if delay_id in self._active_delays:
            task = self._active_delays[delay_id]
            if not task.done():
                task.cancel()
            del self._active_delays[delay_id]
            logger.info("Delay cancelled", delay_id=delay_id)
            return True
        return False
    
    def get_active_delays(self) -> list[str]:
        """Get list of active delay IDs."""
        return list(self._active_delays.keys())
    
    def set_rate_limit_signal(self, key: str, multiplier: float):
        """
        Set a rate limit signal for adaptive delays.
        
        Args:
            key: Identifier for the rate limit context
            multiplier: Delay multiplier (1.0 = normal, 2.0 = double)
        """
        self._rate_limit_signals[key] = max(0.5, min(multiplier, 5.0))
    
    def reset_progressive_counter(self, prefix: str = None):
        """Reset progressive delay counters."""
        if prefix:
            keys_to_delete = [k for k in self._progressive_counter if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._progressive_counter[k]
        else:
            self._progressive_counter.clear()


# Singleton instance
_delay_service: Optional[IntelligentDelayService] = None


def get_delay_service() -> IntelligentDelayService:
    """Get singleton IntelligentDelayService instance."""
    global _delay_service
    if _delay_service is None:
        _delay_service = IntelligentDelayService()
    return _delay_service


# ===========================================
# Helper Functions for Campaign Usage
# ===========================================

async def campaign_delay(
    batch_index: int = 0,
    min_seconds: float = 30,
    max_seconds: float = 50
) -> float:
    """
    Convenience function for campaign message delays.
    
    Uses progressive strategy that gradually increases
    delay as more messages are sent.
    
    Args:
        batch_index: Current batch number
        min_seconds: Minimum delay
        max_seconds: Maximum delay (capped at 50s)
        
    Returns:
        Actual delay duration in seconds
    """
    service = get_delay_service()
    
    result = await service.delay(
        min_seconds=min_seconds,
        max_seconds=max_seconds,
        strategy=DelayStrategy.PROGRESSIVE,
        delay_id=f"campaign_batch_{batch_index}"
    )
    
    logger.info(
        "Campaign delay completed",
        batch=batch_index,
        duration=result.actual_duration_seconds
    )
    
    return result.actual_duration_seconds


async def reengagement_delay(
    conversation_id: str,
    attempt: int = 1,
    base_delay_seconds: float = 120
) -> float:
    """
    Delay for reengagement attempts.
    
    Uses adaptive strategy that increases with each attempt.
    
    Args:
        conversation_id: Conversation being reengaged
        attempt: Attempt number (1, 2, 3, ...)
        base_delay_seconds: Base delay for first attempt
        
    Returns:
        Actual delay duration in seconds
    """
    service = get_delay_service()
    
    # Progressive delay: 2min, 4min, 8min (capped at 50s for this service)
    # Note: For longer delays, use external scheduler
    delay = min(base_delay_seconds * (2 ** (attempt - 1)), 50)
    
    result = await service.delay(
        min_seconds=delay * 0.8,
        max_seconds=delay,
        strategy=DelayStrategy.RANDOM_RANGE,
        delay_id=f"reengagement_{conversation_id}_{attempt}"
    )
    
    return result.actual_duration_seconds
