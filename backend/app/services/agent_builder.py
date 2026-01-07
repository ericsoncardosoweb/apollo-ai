"""
Apollo A.I. Advanced - Agent Builder Service
=============================================

Core service for Agent Builder IDE functionality:
- Prompt version management (Git-like)
- CRM field registry (autocomplete)
- Variable validation and expansion
- AI Prompt Assistant
"""

import re
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime
import structlog

from app.core.config import settings

logger = structlog.get_logger()


@dataclass
class PromptVersion:
    id: str
    agent_id: str
    version: int
    system_prompt: str
    change_description: Optional[str]
    created_at: datetime
    is_active: bool
    performance_score: Optional[float]
    tokens_count: Optional[int]


@dataclass
class CRMField:
    id: str
    field_path: str
    field_type: str
    source_table: str
    description: Optional[str]
    example_value: Optional[str]


@dataclass
class ValidationError:
    field: str
    message: str
    line: Optional[int] = None
    column: Optional[int] = None


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[ValidationError]
    warnings: List[str]
    variables_found: List[str]


@dataclass
class PromptAnalysis:
    tokens_count: int
    complexity_score: float  # 0-100
    suggestions: List[str]
    structure_issues: List[str]


class AgentBuilderService:
    """
    Core service for Agent Builder IDE
    
    Features:
    - Prompt versioning with auto-increment
    - Variable validation ({{...}}) against CRM schema
    - AI-powered prompt improvement suggestions
    """
    
    def __init__(self, supabase):
        self.supabase = supabase
        self._openai_client = None
    
    @property
    def openai(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            from openai import AsyncOpenAI
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client
    
    # ===========================================
    # PROMPT VERSION MANAGEMENT
    # ===========================================
    
    async def save_prompt_version(
        self,
        agent_id: str,
        prompt: str,
        description: str = None,
        created_by: str = None
    ) -> PromptVersion:
        """Save a new version of the agent's prompt"""
        
        # Count tokens (approximate)
        tokens_count = len(prompt.split()) * 1.3  # rough estimate
        
        # Insert new version (version auto-increments via trigger)
        result = self.supabase.table("agent_prompt_versions").insert({
            "agent_id": agent_id,
            "system_prompt": prompt,
            "change_description": description,
            "created_by": created_by,
            "tokens_count": int(tokens_count),
            "is_active": True
        }).execute()
        
        if not result.data:
            raise Exception("Failed to save prompt version")
        
        version_data = result.data[0]
        
        # Deactivate previous versions
        self.supabase.table("agent_prompt_versions").update({
            "is_active": False
        }).eq("agent_id", agent_id).neq("id", version_data["id"]).execute()
        
        # Update agent's system_prompt
        self.supabase.table("agents").update({
            "system_prompt": prompt
        }).eq("id", agent_id).execute()
        
        logger.info(
            "Prompt version saved",
            agent_id=agent_id,
            version=version_data["version"]
        )
        
        return PromptVersion(**version_data)
    
    async def get_prompt_history(
        self,
        agent_id: str,
        limit: int = 20
    ) -> List[PromptVersion]:
        """Get version history for an agent's prompt"""
        
        result = self.supabase.table("agent_prompt_versions").select("*").eq(
            "agent_id", agent_id
        ).order("version", desc=True).limit(limit).execute()
        
        return [PromptVersion(**v) for v in (result.data or [])]
    
    async def rollback_to_version(
        self,
        agent_id: str,
        version_id: str
    ) -> PromptVersion:
        """Rollback to a previous prompt version"""
        
        # Get the target version
        version_result = self.supabase.table("agent_prompt_versions").select("*").eq(
            "id", version_id
        ).single().execute()
        
        if not version_result.data:
            raise Exception("Version not found")
        
        old_version = version_result.data
        
        # Create a new version with the old content
        new_version = await self.save_prompt_version(
            agent_id=agent_id,
            prompt=old_version["system_prompt"],
            description=f"Rollback to version {old_version['version']}"
        )
        
        logger.info(
            "Prompt rolled back",
            agent_id=agent_id,
            from_version=old_version["version"],
            to_version=new_version.version
        )
        
        return new_version
    
    async def compare_versions(
        self,
        version_id_1: str,
        version_id_2: str
    ) -> Dict[str, Any]:
        """Compare two prompt versions (diff)"""
        
        v1 = self.supabase.table("agent_prompt_versions").select("*").eq(
            "id", version_id_1
        ).single().execute()
        
        v2 = self.supabase.table("agent_prompt_versions").select("*").eq(
            "id", version_id_2
        ).single().execute()
        
        if not v1.data or not v2.data:
            raise Exception("One or both versions not found")
        
        # Simple line-by-line diff
        lines1 = v1.data["system_prompt"].split("\n")
        lines2 = v2.data["system_prompt"].split("\n")
        
        import difflib
        diff = list(difflib.unified_diff(
            lines1, lines2,
            fromfile=f"v{v1.data['version']}",
            tofile=f"v{v2.data['version']}",
            lineterm=""
        ))
        
        return {
            "version_1": v1.data,
            "version_2": v2.data,
            "diff": diff,
            "additions": len([l for l in diff if l.startswith("+") and not l.startswith("+++")]),
            "deletions": len([l for l in diff if l.startswith("-") and not l.startswith("---")])
        }
    
    # ===========================================
    # CRM FIELD REGISTRY
    # ===========================================
    
    async def get_available_fields(
        self,
        tenant_id: str = None
    ) -> List[CRMField]:
        """Get available CRM fields for autocomplete"""
        
        query = self.supabase.table("crm_field_registry").select("*").eq(
            "is_active", True
        )
        
        if tenant_id:
            query = query.or_(f"tenant_id.is.null,tenant_id.eq.{tenant_id}")
        
        result = query.order("field_path").execute()
        
        return [CRMField(
            id=f["id"],
            field_path=f["field_path"],
            field_type=f["field_type"],
            source_table=f["source_table"],
            description=f.get("description"),
            example_value=f.get("example_value")
        ) for f in (result.data or [])]
    
    async def add_custom_field(
        self,
        tenant_id: str,
        field_path: str,
        field_type: str,
        source_table: str,
        description: str = None
    ) -> CRMField:
        """Add a custom CRM field for a tenant"""
        
        result = self.supabase.table("crm_field_registry").insert({
            "tenant_id": tenant_id,
            "field_path": field_path,
            "field_type": field_type,
            "source_table": source_table,
            "description": description
        }).execute()
        
        if not result.data:
            raise Exception("Failed to add custom field")
        
        return CRMField(**result.data[0])
    
    # ===========================================
    # VARIABLE VALIDATION
    # ===========================================
    
    async def validate_prompt_variables(
        self,
        prompt: str,
        tenant_id: str = None
    ) -> ValidationResult:
        """Validate {{variables}} in a prompt against available CRM fields"""
        
        # Find all variables
        pattern = r'\{\{([^}]+)\}\}'
        matches = re.findall(pattern, prompt)
        
        # Get available fields
        fields = await self.get_available_fields(tenant_id)
        valid_paths = {f.field_path for f in fields}
        
        errors = []
        warnings = []
        variables_found = []
        
        for match in matches:
            var_name = match.strip()
            variables_found.append(var_name)
            
            if var_name not in valid_paths:
                # Find position in prompt
                idx = prompt.find("{{" + match + "}}")
                line = prompt[:idx].count("\n") + 1
                
                errors.append(ValidationError(
                    field=var_name,
                    message=f"Campo '{var_name}' não encontrado no CRM",
                    line=line
                ))
        
        # Check for potential issues
        if len(matches) == 0:
            warnings.append("Nenhuma variável dinâmica encontrada. Considere usar {{lead.name}} para personalização.")
        
        if len(prompt) > 4000:
            warnings.append("Prompt muito longo. Considere resumir para melhor performance.")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            variables_found=list(set(variables_found))
        )
    
    async def expand_prompt_variables(
        self,
        prompt: str,
        context: Dict[str, Any]
    ) -> str:
        """Replace {{variables}} with actual values from context"""
        
        def replace_var(match):
            var_path = match.group(1).strip()
            parts = var_path.split(".")
            
            value = context
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    return match.group(0)  # Keep original if not found
            
            return str(value) if value is not None else ""
        
        pattern = r'\{\{([^}]+)\}\}'
        return re.sub(pattern, replace_var, prompt)
    
    # ===========================================
    # AI PROMPT ASSISTANT
    # ===========================================
    
    async def generate_prompt_suggestion(
        self,
        instruction: str,
        current_prompt: str = ""
    ) -> str:
        """Generate or improve a prompt based on user instruction"""
        
        system = """Você é um especialista em engenharia de prompts para agentes de IA de atendimento ao cliente.
        
Regras:
- Use variáveis dinâmicas no formato {{campo.subcampo}} (ex: {{lead.name}}, {{deal.stage}})
- Estruture com ## para seções (ex: ## REGRAS, ## ESCOPO)
- Use **negrito** para ênfase
- Use ❌ para proibições e ✅ para permissões
- Seja direto e objetivo"""
        
        user_message = f"""Instrução: {instruction}

Prompt atual (se houver):
{current_prompt if current_prompt else "(vazio)"}

Gere um prompt melhorado ou novo seguindo as melhores práticas."""

        try:
            response = await self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=2000,
                temperature=0.7
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error("Prompt generation failed", error=str(e))
            raise
    
    async def analyze_prompt_quality(
        self,
        prompt: str
    ) -> PromptAnalysis:
        """Analyze prompt quality and provide suggestions"""
        
        # Token count (approximate)
        tokens_count = int(len(prompt.split()) * 1.3)
        
        # Complexity analysis
        issues = []
        suggestions = []
        
        # Check structure
        if "##" not in prompt:
            issues.append("Prompt não possui seções estruturadas (##)")
            suggestions.append("Adicione seções como ## REGRAS, ## ESCOPO, ## RESTRIÇÕES")
        
        if "{{" not in prompt:
            suggestions.append("Considere usar variáveis dinâmicas como {{lead.name}}")
        
        if len(prompt) < 100:
            issues.append("Prompt muito curto")
            suggestions.append("Adicione mais contexto e instruções específicas")
        
        if len(prompt) > 5000:
            issues.append("Prompt muito longo (>5000 caracteres)")
            suggestions.append("Considere resumir para melhor performance")
        
        # Complexity score
        complexity_score = min(100, max(0,
            50 +
            (10 if "##" in prompt else -10) +
            (10 if "{{" in prompt else -10) +
            (20 if 200 < len(prompt) < 3000 else -20) +
            (10 if "**" in prompt else 0)
        ))
        
        return PromptAnalysis(
            tokens_count=tokens_count,
            complexity_score=complexity_score,
            suggestions=suggestions,
            structure_issues=issues
        )


# Factory function
def get_agent_builder_service(supabase) -> AgentBuilderService:
    """Create AgentBuilderService instance"""
    return AgentBuilderService(supabase)
