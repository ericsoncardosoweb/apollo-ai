"""
Apollo A.I. Advanced - Agent Builder API
=========================================

API endpoints for Agent Builder IDE:
- Prompt versions (CRUD + rollback)
- CRM fields (autocomplete)
- Test suites and cases
- Test execution
- AI assistant
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.api.deps import get_current_user, ClientSupabase
from app.services.agent_builder import get_agent_builder_service
from app.services.agent_test_runner import get_agent_test_service

router = APIRouter(prefix="/agent-builder", tags=["Agent Builder"])


# ===========================================
# SCHEMAS
# ===========================================

class PromptVersionCreate(BaseModel):
    system_prompt: str
    change_description: Optional[str] = None


class PromptVersionResponse(BaseModel):
    id: str
    agent_id: str
    version: int
    system_prompt: str
    change_description: Optional[str]
    created_at: datetime
    is_active: bool
    performance_score: Optional[float]
    tokens_count: Optional[int]


class CRMFieldResponse(BaseModel):
    id: str
    field_path: str
    field_type: str
    source_table: str
    description: Optional[str]
    example_value: Optional[str]


class ValidatePromptRequest(BaseModel):
    prompt: str


class ValidationErrorResponse(BaseModel):
    field: str
    message: str
    line: Optional[int]


class ValidatePromptResponse(BaseModel):
    is_valid: bool
    errors: List[ValidationErrorResponse]
    warnings: List[str]
    variables_found: List[str]


class GeneratePromptRequest(BaseModel):
    instruction: str
    current_prompt: Optional[str] = ""


class PromptAnalysisResponse(BaseModel):
    tokens_count: int
    complexity_score: float
    suggestions: List[str]
    structure_issues: List[str]


class TestSuiteCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "functional"
    context: Optional[Dict[str, Any]] = None


class TestSuiteResponse(BaseModel):
    id: str
    agent_id: str
    name: str
    description: Optional[str]
    category: str
    context: Dict
    is_active: bool
    pass_rate: float
    last_run_at: Optional[datetime]
    test_cases_count: Optional[int] = 0


class TestCaseMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    expected_response: Optional[str] = None


class TestCaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    messages: List[TestCaseMessage]
    expected_tools: Optional[List[str]] = None
    expected_tone: Optional[str] = None
    context: Optional[Dict[str, Any]] = None


class TestCaseResponse(BaseModel):
    id: str
    suite_id: str
    name: str
    description: Optional[str]
    messages: List[Dict]
    expected_tools: Optional[List[str]]
    expected_tone: Optional[str]
    context: Dict
    is_active: bool
    order_index: int
    last_score: Optional[float]
    last_run_at: Optional[datetime]


class ExecutionStepResponse(BaseModel):
    step_type: str
    name: str
    success: bool
    duration_ms: int
    details: Dict
    test_mode: bool = True


class TestResultResponse(BaseModel):
    id: str
    case_id: str
    status: str
    score: float
    user_input: str
    expected_response: Optional[str]
    actual_response: str
    tools_called: List[Dict]
    execution_steps: List[ExecutionStepResponse]
    duration_ms: int
    error_message: Optional[str]


class TestRunResponse(BaseModel):
    id: str
    agent_id: str
    suite_id: Optional[str]
    status: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    average_score: float
    duration_ms: Optional[int]
    triggered_by: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class TestRunDetailResponse(TestRunResponse):
    results: List[TestResultResponse] = []


# ===========================================
# PROMPT VERSIONS
# ===========================================

@router.get("/agents/{agent_id}/versions", response_model=List[PromptVersionResponse])
async def get_prompt_versions(
    agent_id: str,
    limit: int = 20,
    client_supabase: ClientSupabase = Depends()
):
    """Get prompt version history for an agent"""
    service = get_agent_builder_service(client_supabase)
    versions = await service.get_prompt_history(agent_id, limit)
    return [PromptVersionResponse(**v.__dict__) for v in versions]


@router.post("/agents/{agent_id}/versions", response_model=PromptVersionResponse)
async def create_prompt_version(
    agent_id: str,
    data: PromptVersionCreate,
    client_supabase: ClientSupabase = Depends(),
    current_user = Depends(get_current_user)
):
    """Save a new prompt version"""
    service = get_agent_builder_service(client_supabase)
    version = await service.save_prompt_version(
        agent_id=agent_id,
        prompt=data.system_prompt,
        description=data.change_description,
        created_by=current_user.get("id")
    )
    return PromptVersionResponse(**version.__dict__)


@router.post("/agents/{agent_id}/versions/{version_id}/rollback", response_model=PromptVersionResponse)
async def rollback_prompt(
    agent_id: str,
    version_id: str,
    client_supabase: ClientSupabase = Depends()
):
    """Rollback to a previous prompt version"""
    service = get_agent_builder_service(client_supabase)
    version = await service.rollback_to_version(agent_id, version_id)
    return PromptVersionResponse(**version.__dict__)


@router.get("/agents/{agent_id}/versions/compare")
async def compare_versions(
    agent_id: str,
    v1: str,
    v2: str,
    client_supabase: ClientSupabase = Depends()
):
    """Compare two prompt versions"""
    service = get_agent_builder_service(client_supabase)
    return await service.compare_versions(v1, v2)


# ===========================================
# CRM FIELDS (AUTOCOMPLETE)
# ===========================================

@router.get("/fields", response_model=List[CRMFieldResponse])
async def get_crm_fields(
    client_supabase: ClientSupabase = Depends()
):
    """Get available CRM fields for autocomplete"""
    service = get_agent_builder_service(client_supabase)
    fields = await service.get_available_fields()
    return [CRMFieldResponse(**f.__dict__) for f in fields]


# ===========================================
# VALIDATION
# ===========================================

@router.post("/agents/{agent_id}/validate-prompt", response_model=ValidatePromptResponse)
async def validate_prompt(
    agent_id: str,
    data: ValidatePromptRequest,
    client_supabase: ClientSupabase = Depends()
):
    """Validate prompt variables against CRM schema"""
    service = get_agent_builder_service(client_supabase)
    result = await service.validate_prompt_variables(data.prompt)
    return ValidatePromptResponse(
        is_valid=result.is_valid,
        errors=[ValidationErrorResponse(**e.__dict__) for e in result.errors],
        warnings=result.warnings,
        variables_found=result.variables_found
    )


# ===========================================
# AI ASSISTANT
# ===========================================

@router.post("/agents/{agent_id}/generate-prompt")
async def generate_prompt(
    agent_id: str,
    data: GeneratePromptRequest,
    client_supabase: ClientSupabase = Depends()
):
    """Generate or improve a prompt using AI"""
    service = get_agent_builder_service(client_supabase)
    suggestion = await service.generate_prompt_suggestion(
        instruction=data.instruction,
        current_prompt=data.current_prompt or ""
    )
    return {"suggestion": suggestion}


@router.post("/agents/{agent_id}/analyze-prompt", response_model=PromptAnalysisResponse)
async def analyze_prompt(
    agent_id: str,
    data: ValidatePromptRequest,
    client_supabase: ClientSupabase = Depends()
):
    """Analyze prompt quality and get suggestions"""
    service = get_agent_builder_service(client_supabase)
    analysis = await service.analyze_prompt_quality(data.prompt)
    return PromptAnalysisResponse(**analysis.__dict__)


# ===========================================
# TEST SUITES
# ===========================================

@router.get("/agents/{agent_id}/test-suites", response_model=List[TestSuiteResponse])
async def get_test_suites(
    agent_id: str,
    client_supabase: ClientSupabase = Depends()
):
    """Get all test suites for an agent"""
    service = get_agent_test_service(client_supabase)
    suites = await service.get_test_suites(agent_id, include_cases=True)
    return [TestSuiteResponse(
        **{k: v for k, v in s.__dict__.items() if k != 'test_cases'},
        test_cases_count=len(s.test_cases)
    ) for s in suites]


@router.post("/agents/{agent_id}/test-suites", response_model=TestSuiteResponse)
async def create_test_suite(
    agent_id: str,
    data: TestSuiteCreate,
    client_supabase: ClientSupabase = Depends()
):
    """Create a new test suite"""
    service = get_agent_test_service(client_supabase)
    suite = await service.create_test_suite(
        agent_id=agent_id,
        name=data.name,
        description=data.description,
        category=data.category,
        context=data.context
    )
    return TestSuiteResponse(**suite.__dict__, test_cases_count=0)


@router.put("/test-suites/{suite_id}", response_model=TestSuiteResponse)
async def update_test_suite(
    suite_id: str,
    data: TestSuiteCreate,
    client_supabase: ClientSupabase = Depends()
):
    """Update a test suite"""
    service = get_agent_test_service(client_supabase)
    suite = await service.update_test_suite(
        suite_id=suite_id,
        name=data.name,
        description=data.description,
        category=data.category,
        context=data.context
    )
    return TestSuiteResponse(**suite.__dict__, test_cases_count=0)


@router.delete("/test-suites/{suite_id}")
async def delete_test_suite(
    suite_id: str,
    client_supabase: ClientSupabase = Depends()
):
    """Delete a test suite"""
    service = get_agent_test_service(client_supabase)
    await service.delete_test_suite(suite_id)
    return {"success": True}


# ===========================================
# TEST CASES
# ===========================================

@router.get("/test-suites/{suite_id}/cases", response_model=List[TestCaseResponse])
async def get_test_cases(
    suite_id: str,
    client_supabase: ClientSupabase = Depends()
):
    """Get all test cases in a suite"""
    service = get_agent_test_service(client_supabase)
    cases = await service.get_test_cases(suite_id)
    return [TestCaseResponse(**c.__dict__) for c in cases]


@router.post("/test-suites/{suite_id}/cases", response_model=TestCaseResponse)
async def create_test_case(
    suite_id: str,
    data: TestCaseCreate,
    client_supabase: ClientSupabase = Depends()
):
    """Create a new test case"""
    service = get_agent_test_service(client_supabase)
    case = await service.create_test_case(
        suite_id=suite_id,
        name=data.name,
        description=data.description,
        messages=[m.dict() for m in data.messages],
        expected_tools=data.expected_tools,
        expected_tone=data.expected_tone,
        context=data.context
    )
    return TestCaseResponse(**case.__dict__)


@router.put("/test-cases/{case_id}", response_model=TestCaseResponse)
async def update_test_case(
    case_id: str,
    data: TestCaseCreate,
    client_supabase: ClientSupabase = Depends()
):
    """Update a test case"""
    service = get_agent_test_service(client_supabase)
    case = await service.update_test_case(
        case_id=case_id,
        name=data.name,
        description=data.description,
        messages=[m.dict() for m in data.messages],
        expected_tools=data.expected_tools,
        expected_tone=data.expected_tone,
        context=data.context
    )
    return TestCaseResponse(**case.__dict__)


# ===========================================
# TEST EXECUTION
# ===========================================

@router.post("/agents/{agent_id}/run-all-tests", response_model=TestRunDetailResponse)
async def run_all_tests(
    agent_id: str,
    background_tasks: BackgroundTasks,
    client_supabase: ClientSupabase = Depends()
):
    """Run all tests for an agent"""
    service = get_agent_test_service(client_supabase)
    run = await service.run_all_tests(agent_id, triggered_by="manual")
    
    return TestRunDetailResponse(
        id=run.id,
        agent_id=run.agent_id,
        suite_id=run.suite_id,
        status=run.status.value,
        total_tests=run.total_tests,
        passed_tests=run.passed_tests,
        failed_tests=run.failed_tests,
        average_score=run.average_score,
        duration_ms=run.duration_ms,
        triggered_by=run.triggered_by,
        started_at=None,
        completed_at=None,
        results=[TestResultResponse(
            id=r.id,
            case_id=r.case_id,
            status=r.status.value,
            score=r.score,
            user_input=r.user_input,
            expected_response=r.expected_response,
            actual_response=r.actual_response,
            tools_called=r.tools_called,
            execution_steps=[ExecutionStepResponse(**s.__dict__) for s in r.execution_steps],
            duration_ms=r.duration_ms,
            error_message=r.error_message
        ) for r in run.results]
    )


@router.post("/test-suites/{suite_id}/run", response_model=TestRunResponse)
async def run_test_suite(
    suite_id: str,
    client_supabase: ClientSupabase = Depends()
):
    """Run all tests in a specific suite"""
    service = get_agent_test_service(client_supabase)
    run = await service.run_test_suite(suite_id, triggered_by="manual")
    
    return TestRunResponse(
        id=run.id,
        agent_id=run.agent_id,
        suite_id=run.suite_id,
        status=run.status.value,
        total_tests=run.total_tests,
        passed_tests=run.passed_tests,
        failed_tests=run.failed_tests,
        average_score=run.average_score,
        duration_ms=run.duration_ms,
        triggered_by=run.triggered_by,
        started_at=None,
        completed_at=None
    )


@router.get("/agents/{agent_id}/test-runs", response_model=List[TestRunResponse])
async def get_test_runs(
    agent_id: str,
    limit: int = 20,
    client_supabase: ClientSupabase = Depends()
):
    """Get test run history for an agent"""
    result = client_supabase.table("agent_test_runs").select("*").eq(
        "agent_id", agent_id
    ).order("created_at", desc=True).limit(limit).execute()
    
    return [TestRunResponse(**r) for r in (result.data or [])]


@router.get("/test-runs/{run_id}", response_model=TestRunDetailResponse)
async def get_test_run(
    run_id: str,
    client_supabase: ClientSupabase = Depends()
):
    """Get detailed test run with results"""
    run_result = client_supabase.table("agent_test_runs").select("*").eq(
        "id", run_id
    ).single().execute()
    
    if not run_result.data:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    results = client_supabase.table("agent_test_results").select("*").eq(
        "run_id", run_id
    ).execute()
    
    run_data = run_result.data
    
    return TestRunDetailResponse(
        **run_data,
        results=[TestResultResponse(**r) for r in (results.data or [])]
    )


@router.get("/agents/{agent_id}/check-regression")
async def check_regression(
    agent_id: str,
    score: float,
    client_supabase: ClientSupabase = Depends()
):
    """Check if a score represents a regression"""
    service = get_agent_test_service(client_supabase)
    result = await service.check_regression(agent_id, score)
    
    if result:
        return result
    
    return {"is_regression": False}
