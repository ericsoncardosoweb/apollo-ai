"""
Apollo A.I. Advanced - Agent Test Runner Service
=================================================

QA automation service for AI agents:
- Test suite and case management
- Test execution with scoring
- Semantic similarity scoring
- Regression detection
"""

import asyncio
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class TestStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


@dataclass
class TestCase:
    id: str
    suite_id: str
    name: str
    description: Optional[str]
    messages: List[Dict]  # [{role, content, expected_response?}]
    expected_tools: Optional[List[str]]
    expected_tone: Optional[str]
    context: Dict
    is_active: bool
    order_index: int


@dataclass
class TestSuite:
    id: str
    agent_id: str
    name: str
    description: Optional[str]
    category: str
    context: Dict
    is_active: bool
    pass_rate: float
    last_run_at: Optional[datetime]
    test_cases: List[TestCase] = field(default_factory=list)


@dataclass
class ExecutionStep:
    step_type: str  # "thought", "tool_call", "guardrail", "response"
    name: str
    success: bool
    duration_ms: int
    details: Dict
    test_mode: bool = True


@dataclass
class TestResult:
    id: str
    case_id: str
    status: TestStatus
    score: float
    user_input: str
    expected_response: Optional[str]
    actual_response: str
    tools_called: List[Dict]
    execution_steps: List[ExecutionStep]
    duration_ms: int
    error_message: Optional[str] = None


@dataclass
class TestRun:
    id: str
    agent_id: str
    suite_id: Optional[str]
    status: TestStatus
    total_tests: int
    passed_tests: int
    failed_tests: int
    average_score: float
    duration_ms: int
    triggered_by: str
    results: List[TestResult] = field(default_factory=list)


class AgentTestService:
    """
    Test Runner - QA automation for AI agents
    
    Features:
    - Create and manage test suites/cases
    - Run tests with simulated conversations
    - Score responses using semantic similarity
    - Detect regressions across prompt versions
    """
    
    def __init__(self, supabase):
        self.supabase = supabase
        self._openai_client = None
        self._embedding_cache = {}
    
    @property
    def openai(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client
    
    # ===========================================
    # TEST SUITE MANAGEMENT
    # ===========================================
    
    async def create_test_suite(
        self,
        agent_id: str,
        name: str,
        description: str = None,
        category: str = "functional",
        context: Dict = None
    ) -> TestSuite:
        """Create a new test suite for an agent"""
        
        result = self.supabase.table("agent_test_suites").insert({
            "agent_id": agent_id,
            "name": name,
            "description": description,
            "category": category,
            "context": context or {}
        }).execute()
        
        if not result.data:
            raise Exception("Failed to create test suite")
        
        return TestSuite(**result.data[0], test_cases=[])
    
    async def get_test_suites(
        self,
        agent_id: str,
        include_cases: bool = True
    ) -> List[TestSuite]:
        """Get all test suites for an agent"""
        
        result = self.supabase.table("agent_test_suites").select("*").eq(
            "agent_id", agent_id
        ).order("created_at").execute()
        
        suites = []
        for suite_data in (result.data or []):
            suite = TestSuite(**suite_data, test_cases=[])
            
            if include_cases:
                cases = await self.get_test_cases(suite.id)
                suite.test_cases = cases
            
            suites.append(suite)
        
        return suites
    
    async def update_test_suite(
        self,
        suite_id: str,
        **updates
    ) -> TestSuite:
        """Update a test suite"""
        
        updates["updated_at"] = datetime.utcnow().isoformat()
        
        result = self.supabase.table("agent_test_suites").update(
            updates
        ).eq("id", suite_id).execute()
        
        if not result.data:
            raise Exception("Failed to update test suite")
        
        return TestSuite(**result.data[0], test_cases=[])
    
    async def delete_test_suite(self, suite_id: str) -> bool:
        """Delete a test suite and all its cases"""
        self.supabase.table("agent_test_suites").delete().eq("id", suite_id).execute()
        return True
    
    # ===========================================
    # TEST CASE MANAGEMENT
    # ===========================================
    
    async def create_test_case(
        self,
        suite_id: str,
        name: str,
        messages: List[Dict],
        description: str = None,
        expected_tools: List[str] = None,
        expected_tone: str = None,
        context: Dict = None
    ) -> TestCase:
        """Create a test case in a suite"""
        
        # Get max order index
        existing = self.supabase.table("agent_test_cases").select("order_index").eq(
            "suite_id", suite_id
        ).order("order_index", desc=True).limit(1).execute()
        
        next_index = (existing.data[0]["order_index"] + 1) if existing.data else 0
        
        result = self.supabase.table("agent_test_cases").insert({
            "suite_id": suite_id,
            "name": name,
            "description": description,
            "messages": messages,
            "expected_tools": expected_tools,
            "expected_tone": expected_tone,
            "context": context or {},
            "order_index": next_index
        }).execute()
        
        if not result.data:
            raise Exception("Failed to create test case")
        
        return TestCase(**result.data[0])
    
    async def get_test_cases(self, suite_id: str) -> List[TestCase]:
        """Get all test cases in a suite"""
        
        result = self.supabase.table("agent_test_cases").select("*").eq(
            "suite_id", suite_id
        ).eq("is_active", True).order("order_index").execute()
        
        return [TestCase(**c) for c in (result.data or [])]
    
    async def update_test_case(
        self,
        case_id: str,
        **updates
    ) -> TestCase:
        """Update a test case"""
        
        updates["updated_at"] = datetime.utcnow().isoformat()
        
        result = self.supabase.table("agent_test_cases").update(
            updates
        ).eq("id", case_id).execute()
        
        if not result.data:
            raise Exception("Failed to update test case")
        
        return TestCase(**result.data[0])
    
    # ===========================================
    # TEST EXECUTION
    # ===========================================
    
    async def run_all_tests(
        self,
        agent_id: str,
        triggered_by: str = "manual"
    ) -> TestRun:
        """Run all test suites for an agent"""
        
        # Get all active suites
        suites = await self.get_test_suites(agent_id, include_cases=True)
        active_suites = [s for s in suites if s.is_active]
        
        # Create test run
        total_cases = sum(len(s.test_cases) for s in active_suites)
        
        run_result = self.supabase.table("agent_test_runs").insert({
            "agent_id": agent_id,
            "status": "running",
            "total_tests": total_cases,
            "triggered_by": triggered_by,
            "started_at": datetime.utcnow().isoformat()
        }).execute()
        
        run_id = run_result.data[0]["id"]
        
        # Run all tests
        all_results = []
        passed = 0
        failed = 0
        
        for suite in active_suites:
            for case in suite.test_cases:
                try:
                    result = await self._execute_test_case(
                        run_id=run_id,
                        agent_id=agent_id,
                        case=case,
                        suite_context=suite.context
                    )
                    all_results.append(result)
                    
                    if result.status == TestStatus.PASSED:
                        passed += 1
                    else:
                        failed += 1
                        
                except Exception as e:
                    logger.error("Test case failed", case_id=case.id, error=str(e))
                    failed += 1
        
        # Calculate average score
        avg_score = sum(r.score for r in all_results) / len(all_results) if all_results else 0
        
        # Update run status
        final_status = "passed" if failed == 0 else "failed"
        
        self.supabase.table("agent_test_runs").update({
            "status": final_status,
            "passed_tests": passed,
            "failed_tests": failed,
            "average_score": avg_score,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", run_id).execute()
        
        return TestRun(
            id=run_id,
            agent_id=agent_id,
            suite_id=None,
            status=TestStatus(final_status),
            total_tests=total_cases,
            passed_tests=passed,
            failed_tests=failed,
            average_score=avg_score,
            duration_ms=0,
            triggered_by=triggered_by,
            results=all_results
        )
    
    async def run_test_suite(
        self,
        suite_id: str,
        triggered_by: str = "manual"
    ) -> TestRun:
        """Run all tests in a specific suite"""
        
        # Get suite with cases
        suite_result = self.supabase.table("agent_test_suites").select("*").eq(
            "id", suite_id
        ).single().execute()
        
        if not suite_result.data:
            raise Exception("Suite not found")
        
        suite_data = suite_result.data
        cases = await self.get_test_cases(suite_id)
        
        # Create run
        run_result = self.supabase.table("agent_test_runs").insert({
            "agent_id": suite_data["agent_id"],
            "suite_id": suite_id,
            "status": "running",
            "total_tests": len(cases),
            "triggered_by": triggered_by,
            "started_at": datetime.utcnow().isoformat()
        }).execute()
        
        run_id = run_result.data[0]["id"]
        
        # Execute tests
        results = []
        passed = 0
        
        for case in cases:
            result = await self._execute_test_case(
                run_id=run_id,
                agent_id=suite_data["agent_id"],
                case=case,
                suite_context=suite_data.get("context", {})
            )
            results.append(result)
            if result.status == TestStatus.PASSED:
                passed += 1
        
        # Finalize
        avg_score = sum(r.score for r in results) / len(results) if results else 0
        
        self.supabase.table("agent_test_runs").update({
            "status": "passed" if passed == len(cases) else "failed",
            "passed_tests": passed,
            "failed_tests": len(cases) - passed,
            "average_score": avg_score,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", run_id).execute()
        
        # Update suite pass rate
        self.supabase.table("agent_test_suites").update({
            "pass_rate": avg_score,
            "last_run_at": datetime.utcnow().isoformat()
        }).eq("id", suite_id).execute()
        
        return TestRun(
            id=run_id,
            agent_id=suite_data["agent_id"],
            suite_id=suite_id,
            status=TestStatus.PASSED if passed == len(cases) else TestStatus.FAILED,
            total_tests=len(cases),
            passed_tests=passed,
            failed_tests=len(cases) - passed,
            average_score=avg_score,
            duration_ms=0,
            triggered_by=triggered_by,
            results=results
        )
    
    async def _execute_test_case(
        self,
        run_id: str,
        agent_id: str,
        case: TestCase,
        suite_context: Dict
    ) -> TestResult:
        """Execute a single test case"""
        
        start_time = datetime.utcnow()
        execution_steps = []
        tools_called = []
        
        # Merge contexts
        context = {**suite_context, **case.context}
        
        # Get agent config
        agent_result = self.supabase.table("agents").select("*").eq(
            "id", agent_id
        ).single().execute()
        
        agent = agent_result.data
        
        # Process each message in the test
        final_response = ""
        user_input = ""
        expected_response = ""
        
        for i, msg in enumerate(case.messages):
            if msg.get("role") == "user":
                user_input = msg["content"]
                expected_response = msg.get("expected_response", "")
                
                # Simulate AI response
                execution_steps.append(ExecutionStep(
                    step_type="thought",
                    name="Analyzing message",
                    success=True,
                    duration_ms=50,
                    details={"input": user_input[:100]}
                ))
                
                # Call AI (in test mode)
                try:
                    response = await self.openai.chat.completions.create(
                        model=agent.get("model_name", "gpt-4o-mini"),
                        messages=[
                            {"role": "system", "content": agent.get("system_prompt", "")},
                            {"role": "user", "content": user_input}
                        ],
                        max_tokens=500,
                        temperature=agent.get("temperature", 0.7)
                    )
                    
                    final_response = response.choices[0].message.content.strip()
                    
                    execution_steps.append(ExecutionStep(
                        step_type="response",
                        name="Generated response",
                        success=True,
                        duration_ms=500,
                        details={"response": final_response[:200]}
                    ))
                    
                except Exception as e:
                    execution_steps.append(ExecutionStep(
                        step_type="error",
                        name="AI Generation Failed",
                        success=False,
                        duration_ms=0,
                        details={"error": str(e)}
                    ))
                    raise
        
        # Calculate score
        score = await self._calculate_semantic_score(
            expected=expected_response,
            actual=final_response
        )
        
        # Determine status
        status = TestStatus.PASSED if score >= 70 else TestStatus.FAILED
        
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        # Save result
        result_data = self.supabase.table("agent_test_results").insert({
            "run_id": run_id,
            "case_id": case.id,
            "status": status.value,
            "score": score,
            "user_input": user_input,
            "expected_response": expected_response,
            "actual_response": final_response,
            "tools_called": tools_called,
            "execution_steps": [
                {
                    "step_type": s.step_type,
                    "name": s.name,
                    "success": s.success,
                    "duration_ms": s.duration_ms,
                    "details": s.details,
                    "test_mode": s.test_mode
                }
                for s in execution_steps
            ],
            "duration_ms": duration_ms
        }).execute()
        
        # Update case last score
        self.supabase.table("agent_test_cases").update({
            "last_score": score,
            "last_run_at": datetime.utcnow().isoformat()
        }).eq("id", case.id).execute()
        
        return TestResult(
            id=result_data.data[0]["id"],
            case_id=case.id,
            status=status,
            score=score,
            user_input=user_input,
            expected_response=expected_response,
            actual_response=final_response,
            tools_called=tools_called,
            execution_steps=execution_steps,
            duration_ms=duration_ms
        )
    
    # ===========================================
    # SCORING
    # ===========================================
    
    async def _calculate_semantic_score(
        self,
        expected: str,
        actual: str
    ) -> float:
        """Calculate semantic similarity score using embeddings"""
        
        if not expected:
            return 85.0  # No expected response = pass if no errors
        
        if not actual:
            return 0.0
        
        try:
            # Get embeddings
            response = await self.openai.embeddings.create(
                model="text-embedding-3-small",
                input=[expected, actual]
            )
            
            embed_expected = response.data[0].embedding
            embed_actual = response.data[1].embedding
            
            # Cosine similarity
            dot_product = sum(a * b for a, b in zip(embed_expected, embed_actual))
            magnitude_a = sum(a ** 2 for a in embed_expected) ** 0.5
            magnitude_b = sum(b ** 2 for b in embed_actual) ** 0.5
            
            similarity = dot_product / (magnitude_a * magnitude_b)
            
            # Convert to 0-100 score
            score = (similarity + 1) / 2 * 100
            
            return round(score, 2)
            
        except Exception as e:
            logger.error("Embedding calculation failed", error=str(e))
            # Fallback to simple matching
            return 50.0 if actual else 0.0
    
    # ===========================================
    # REGRESSION DETECTION
    # ===========================================
    
    async def check_regression(
        self,
        agent_id: str,
        new_score: float
    ) -> Optional[Dict]:
        """Check if new score represents a regression"""
        
        # Get last 5 runs
        runs = self.supabase.table("agent_test_runs").select(
            "average_score, created_at"
        ).eq("agent_id", agent_id).eq("status", "passed").order(
            "created_at", desc=True
        ).limit(5).execute()
        
        if not runs.data or len(runs.data) < 2:
            return None
        
        # Calculate baseline (average of previous runs)
        previous_scores = [r["average_score"] for r in runs.data[1:]]  # Skip current
        baseline = sum(previous_scores) / len(previous_scores)
        
        # Check for regression (>10% drop)
        drop = baseline - new_score
        drop_percent = (drop / baseline) * 100 if baseline > 0 else 0
        
        if drop_percent > 10:
            return {
                "is_regression": True,
                "baseline_score": baseline,
                "new_score": new_score,
                "drop_percent": round(drop_percent, 1),
                "message": f"⚠️ A precisão caiu {drop_percent:.1f}%. Baseline: {baseline:.1f}%, Novo: {new_score:.1f}%"
            }
        
        return None


# Factory function
def get_agent_test_service(supabase) -> AgentTestService:
    """Create AgentTestService instance"""
    return AgentTestService(supabase)
