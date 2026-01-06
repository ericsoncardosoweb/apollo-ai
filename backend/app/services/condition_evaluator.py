"""
Condition Evaluator - Rule Engine for Automation Conditions
============================================================

Evaluates dynamic conditions before executing automations.
Supports various operators and field types.
"""

from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
import structlog

logger = structlog.get_logger()


class ConditionEvaluator:
    """
    Evaluates conditions against contact/deal data.
    
    Supported operators:
    - equals, not_equals
    - greater_than, less_than, greater_or_equal, less_or_equal
    - contains, not_contains
    - is_empty, is_not_empty
    - in_list, not_in_list
    - days_ago_greater, days_ago_less (for date comparisons)
    """
    
    def __init__(self):
        self.operators = {
            "equals": self._op_equals,
            "not_equals": self._op_not_equals,
            "greater_than": self._op_greater_than,
            "less_than": self._op_less_than,
            "greater_or_equal": self._op_greater_or_equal,
            "less_or_equal": self._op_less_or_equal,
            "contains": self._op_contains,
            "not_contains": self._op_not_contains,
            "is_empty": self._op_is_empty,
            "is_not_empty": self._op_is_not_empty,
            "in_list": self._op_in_list,
            "not_in_list": self._op_not_in_list,
            "days_ago_greater": self._op_days_ago_greater,
            "days_ago_less": self._op_days_ago_less,
        }
    
    def evaluate_all(
        self, 
        conditions: List[Dict[str, Any]], 
        context: Dict[str, Any],
        match_type: str = "all"  # "all" or "any"
    ) -> bool:
        """
        Evaluate a list of conditions against context.
        
        Args:
            conditions: List of {field, operator, value} dicts
            context: Data to evaluate against (contact + deal data)
            match_type: "all" (AND) or "any" (OR)
            
        Returns:
            True if conditions are met
        """
        if not conditions:
            return True
        
        results = [self.evaluate_single(cond, context) for cond in conditions]
        
        if match_type == "all":
            return all(results)
        else:  # "any"
            return any(results)
    
    def evaluate_single(self, condition: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """
        Evaluate a single condition.
        
        Args:
            condition: {field, operator, value}
            context: Data to evaluate against
            
        Returns:
            True if condition is met
        """
        field = condition.get("field")
        operator = condition.get("operator")
        expected_value = condition.get("value")
        
        if not field or not operator:
            logger.warning("Invalid condition", condition=condition)
            return True  # Skip invalid conditions
        
        # Get actual value from context (supports nested fields with dots)
        actual_value = self._get_nested_value(context, field)
        
        # Get operator function
        op_func = self.operators.get(operator)
        if not op_func:
            logger.warning("Unknown operator", operator=operator)
            return True
        
        try:
            result = op_func(actual_value, expected_value)
            logger.debug(
                "Condition evaluated",
                field=field,
                operator=operator,
                expected=expected_value,
                actual=actual_value,
                result=result
            )
            return result
        except Exception as e:
            logger.error("Condition evaluation error", error=str(e), condition=condition)
            return False
    
    def _get_nested_value(self, data: Dict, field: str) -> Any:
        """Get value from nested dict using dot notation (e.g., 'contact.tags')"""
        keys = field.split(".")
        value = data
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            elif hasattr(value, key):
                value = getattr(value, key)
            else:
                return None
        
        return value
    
    # =========================================================================
    # OPERATOR IMPLEMENTATIONS
    # =========================================================================
    
    def _op_equals(self, actual: Any, expected: Any) -> bool:
        if actual is None:
            return expected is None or expected == ""
        return str(actual).lower() == str(expected).lower()
    
    def _op_not_equals(self, actual: Any, expected: Any) -> bool:
        return not self._op_equals(actual, expected)
    
    def _op_greater_than(self, actual: Any, expected: Any) -> bool:
        try:
            return float(actual or 0) > float(expected or 0)
        except (ValueError, TypeError):
            return False
    
    def _op_less_than(self, actual: Any, expected: Any) -> bool:
        try:
            return float(actual or 0) < float(expected or 0)
        except (ValueError, TypeError):
            return False
    
    def _op_greater_or_equal(self, actual: Any, expected: Any) -> bool:
        try:
            return float(actual or 0) >= float(expected or 0)
        except (ValueError, TypeError):
            return False
    
    def _op_less_or_equal(self, actual: Any, expected: Any) -> bool:
        try:
            return float(actual or 0) <= float(expected or 0)
        except (ValueError, TypeError):
            return False
    
    def _op_contains(self, actual: Any, expected: Any) -> bool:
        if actual is None:
            return False
        if isinstance(actual, list):
            return expected in actual
        return str(expected).lower() in str(actual).lower()
    
    def _op_not_contains(self, actual: Any, expected: Any) -> bool:
        return not self._op_contains(actual, expected)
    
    def _op_is_empty(self, actual: Any, expected: Any = None) -> bool:
        if actual is None:
            return True
        if isinstance(actual, (list, dict, str)):
            return len(actual) == 0
        return False
    
    def _op_is_not_empty(self, actual: Any, expected: Any = None) -> bool:
        return not self._op_is_empty(actual)
    
    def _op_in_list(self, actual: Any, expected: Any) -> bool:
        if not isinstance(expected, list):
            expected = [expected]
        if actual is None:
            return None in expected
        return str(actual).lower() in [str(e).lower() for e in expected]
    
    def _op_not_in_list(self, actual: Any, expected: Any) -> bool:
        return not self._op_in_list(actual, expected)
    
    def _op_days_ago_greater(self, actual: Any, expected: Any) -> bool:
        """Check if date is more than X days ago"""
        days = int(expected or 0)
        if not actual:
            return True  # No date = very old
        
        try:
            if isinstance(actual, str):
                date = datetime.fromisoformat(actual.replace("Z", "+00:00"))
            else:
                date = actual
            
            threshold = datetime.now(timezone.utc) - timedelta(days=days)
            return date < threshold
        except Exception:
            return False
    
    def _op_days_ago_less(self, actual: Any, expected: Any) -> bool:
        """Check if date is less than X days ago"""
        days = int(expected or 0)
        if not actual:
            return False  # No date = consider very old
        
        try:
            if isinstance(actual, str):
                date = datetime.fromisoformat(actual.replace("Z", "+00:00"))
            else:
                date = actual
            
            threshold = datetime.now(timezone.utc) - timedelta(days=days)
            return date >= threshold
        except Exception:
            return False
