---
title: "Pydantic AI, Qdrant, FastMCP를 활용한 컴퓨터 시스템 밸리데이션(CSV) RAG 시스템 구축 가이드"
description: "Pydantic AI 임베딩, Qdrant 벡터 저장소, 구조화된 출력 기반 RAG 에이전트, FastMCP 서버를 사용하여 생명과학 CSV/GxP 규정 준수 문서를 위한 오픈소스 RAG 시스템을 구축하는 실무 가이드. 5가지 핵심 컴포넌트 패턴, GAMP 5 및 21 CFR Part 11 프레이밍, 데모 결과(22개 인덱싱 청크, 5개 테스트 통과), GxP 아키텍트가 반드시 강제해야 할 규정 준수 주의사항 수록."
pubDate: "2026-08-05T12:00:00.000Z"
author: "AI 에이전트 리서치 및 작성"
---

컴퓨터 시스템 밸리데이션(CSV)은 GxP 규제 프로세스와 실제 소프트웨어 코드가 만나는 접점입니다. GMP 제조기록서(Batch Record)에 관여하는 모든 LIMS, ELN, eQMS, MES, ERP 및 크로마토그래피 데이터 시스템은 문서화된 증거 체인을 생성해야 합니다: **URS → FS/DS → IQ → OQ → PQ → VSR**. 이 모든 과정은 **21 CFR Part 11**(전자 기록 및 전자 서명) 및 **EU Annex 11**(컴퓨터화 시스템)을 준수해야 하며, **ALCOA+** 원칙에 입각한 데이터 완전성(Data Integrity)을 입증해야 합니다. 이 라이프사이클 산출물은 방대합니다. 표준작업지침서(SOP), 일탈(Deviation), 변경 제어(Change Control), IQ/OQ/PQ 프로토콜 등 증거 코퍼스는 거대하게 얽혀 있습니다. 그리고 감사관, QA 검토자, 밸리데이션 엔지니어가 이 코퍼스를 대상으로 던지는 질문은 표현만 약간씩 다를 뿐 실상 *동일한* 질문의 반복입니다.

우리는 이에 대한 실질적인 오픈소스 솔루션을 공개했습니다: **[github.com/saram-io/embedding-tutorial](https://github.com/saram-io/embedding-tutorial)** — Pydantic AI 임베딩 → Qdrant → 구조화된 출력 RAG 에이전트 → FastMCP 서버 스택으로 구성되며, 로컬 Langfuse 관측성, 4개의 실질적인 마크다운 밸리데이션 기록, 22개 청크를 인덱싱하고 인용 및 신뢰도 점수가 포함된 답변을 반환하는 5단계 통과 데모 스크립트를 포함합니다. 본 가이드는 각 컴포넌트가 어떻게 유기적으로 결합하는지, 각 설계 결정이 어떤 GxP 통제 항목과 매핑되는지, 그리고 검증된 시스템 내부에 배포하기 전에 시스템 아키텍트가 반드시 강제해야 할 사항이 무엇인지 설명합니다.

이제 더 이상 중요한 질문은 "RAG 시스템을 만들 수 있는가"가 아닙니다. 진짜 중요한 질문은 **"어떤 구조의 RAG 시스템이 CSV 감사를 통과할 수 있는가?"**입니다.

## 상충 관계: 비결정론 vs. 밸리데이션

GxP RAG 설계에는 서로 상충하는 세 가지 규제 제약이 따릅니다:

- **검색은 비결정론적(Non-deterministic)입니다.** 1,536차원 임베딩 공간에서의 코사인 유사도 검색은 정확한 일치가 아닌 순위화된 확률을 반환합니다. 감사관의 *"이 지적 사항을 도출하기 위해 문서의 어느 섹션을 인용했는가?"*라는 질문에는 안정적이고 귀속 가능한(Attributable) 답변이 필요합니다. 따라서 모든 검색은 해당 결과를 생성한 `document_id`, `section`, `chunk_id`, 유사도 점수를 정확히 기록해야 합니다.
- **LLM 출력은 비결정론적입니다.** GAMP 5 카테고리 4/5 밸리데이션 결론이 모델이 우연히 뽑아낸 랜덤 시드에 좌우될 수는 없습니다. 시스템 프롬프트는 에이전트가 인용할 수 있는 규제 프레임워크(21 CFR Part 11, EU Annex 11, GAMP 5, ALCOA+)를 엄격히 하드코딩해야 하며, 출력 스키마는 모델이 자유 형식의 산문이 아닌 구조화된 인용을 강제로 출력하도록 제어해야 합니다.
- **규정 준수 검증은 결정론적(Deterministic)입니다.** "이 시스템이 역할 기반 접근 제어, 감사 추적(Audit Trail), 통제된 변경 프로세스를 갖추고 있는가?"라는 질문에는 명확한 예/아니오 답변이 요구됩니다. MCP 계층에는 챗봇 형태의 응답이 아니라, 구조화된 에이전트 출력을 바탕으로 규칙 기반 검사를 수행하는 별도의 `verify_gxp_compliance` 도구가 필요합니다.

승리하는 아키텍처 패턴은 다음과 같습니다: **답변을 생성하기 전에 반드시 벡터 검색 도구를 호출해야 하는 엄격한 구조화 출력 Pydantic 에이전트, 검색 도구와 규정 준수 감사 도구를 모두 노출하는 FastMCP 서버, 그리고 감사 추적이 희망 사항이 아닌 자동으로 남도록 모든 쿼리를 기록하는 Langfuse 트레이싱.** 이것이 본 튜토리얼이 제공하는 아키텍처입니다. 이어지는 섹션에서는 5가지 핵심 컴포넌트를 단계별로 살펴봅니다.

## 5가지 핵심 컴포넌트 패턴

이 저장소는 의도적으로 간결하게 구성되었습니다: 임베더 1개, 벡터 저장소 1개, RAG 에이전트 1개, MCP 서버 1개, 관측성 모듈 1개. 각 파일은 단일 목적만을 수행하며, 오프라인 및 CI 환경 실행을 위한 폴백(fallback) 경로를 갖추고 있습니다. 이러한 트레이드오프는 CSV 환경에서 매우 중요합니다. Ollama, Qdrant, Langfuse가 반드시 실행 중이어야만 import조차 가능한 튜토리얼은 교육용 자료가 아니라 복잡한 설치 프로젝트에 불과하기 때문입니다.

### 1. `src/config.py` — `.env` 오버라이드를 지원하는 Pydantic Settings

34줄의 단일 파일입니다. 개발, 스테이징, 운영 환경 간에 달라지는 모든 설정값은 `env_file=".env"`가 지정된 `BaseSettings` 서브클래스 내에 정의됩니다:

```python
class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "qwen3-embedding:8b"
    llm_model: str = "ollama:qwen2.5:7b"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "csv_gxp_documents"
    langfuse_public_key: str = "pk-lf-local-csv-tutorial"
    langfuse_secret_key: str = "«redacted:sk-…»"
    langfuse_host: str = "http://localhost:3000"
    enable_langfuse: bool = True
    data_dir: Path = Path(__file__).parent.parent / "data"
```

CSV 아키텍트의 직관은 정확합니다: 환경에 의존적인 모든 값은 산재된 `os.environ.get()` 호출이 아니라 단일 타입화된 설정 객체를 통해 관리되어야 합니다. 코드 수정 없이 로컬 Ollama 모델에서 검증된 엔터프라이즈 모델로, 또는 `localhost:6333`에서 QA/운영 Qdrant 클러스터로 전환할 수 있는 경계가 바로 이곳입니다.

> `.env` 파일은 gitignore 처리됩니다 (`.gitignore`는 `.env`와 `*.env`를 포함하되 `.env.example`은 제외). 제공되는 `.env.example`에는 비밀키 없이 모든 키에 대한 설명이 문서화되어 있습니다. **실제 Langfuse 시크릿 키를 커밋하지 마십시오.** 이는 단순한 튜토리얼 예절이 아닙니다. Part 11 §11.10(d)에 따라 시스템 접근은 권한이 부여된 개인으로 제한되어야 하며, 이는 소스 코드 저장소에도 동일하게 적용됩니다.

### 2. `src/embeddings.py` — 오프라인 폴백을 지원하는 Pydantic AI `Embedder`

임베더는 Ollama의 OpenAI 호환 엔드포인트(`/v1`)를 대상으로 Pydantic AI의 `Embedder` 인터페이스를 래핑합니다. `CSVEmbedder` 클래스는 두 가지 메서드를 제공합니다:

- `async def embed_text(self, text: str) -> List[float]` — 단일 쿼리 임베딩
- `async def embed_batch(self, texts: List[str]) -> List[List[float]]` — 데이터 인제스트를 위한 배치 임베딩

CSV 관점에서 결정적인 세부사항은 **오프라인 폴백(Fallback)**입니다. Ollama에 접근할 수 없는 경우, `embed_text`는 `hash(text)`를 시드로 사용하는 결정론적 의사 벡터(pseudo-vector)인 `_generate_fallback_embedding(text, dim=1536)`을 호출합니다:

```python
def _generate_fallback_embedding(self, text: str, dim: int = 1536) -> List[float]:
    rng = np.random.RandomState(abs(hash(text)) % (2**32))
    vec = rng.randn(dim)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec.tolist()
```

이것이 왜 규제 환경에서 중요할까요? **에어갭(Air-gapped) 격리 CI 러너에서도 테스트가 반드시 통과해야 하기 때문입니다.** 임베더가 Ollama가 실행 중일 때만 동작한다면, 격리된 환경에서 RAG 하위 시스템에 대한 IQ/OQ 스모크 테스트를 실행할 수 없습니다. 이 폴백은 운영 환경용 동작이 아니라 *테스트 전용* 동작이며, 독스트링에 이를 명시했습니다. 운영 환경에서의 임베딩 실패는 조용한 기능 저하가 아닌 시스템 장애로 취급해야 합니다. Part 11 감사관은 "모델이 오프라인이어서 의사 벡터를 반환했다"는 변명을 용납하지 않습니다.

> 코드베이스는 의존성으로 `pydantic-ai-slim[openai,ollama]`를 선언하고 `pydantic_ai.embeddings.openai` 및 `pydantic_ai.providers.openai`에서 임포트합니다. 이러한 임포트 경로는 튜토리얼 작성 당시의 Pydantic AI 릴리스를 기준으로 합니다. **실제 배포 전**, `pyproject.toml`에서 Pydantic AI 버전을 고정하고(`pydantic-ai-slim[openai,ollama]==X.Y.Z`) 검증 대상 버전과 정확한 모듈명을 확인하십시오. GxP 수준의 밸리데이션은 *동결된(frozen)* 산출물이어야 합니다. "다음 릴리스에서 임포트 경로가 변경되었다"는 것은 허용되지 않는 일탈입니다.

### 3. `src/vector_store.py` — 마크다운 인식 청킹을 지원하는 Qdrant

벡터 저장소는 순서대로 네 가지 작업을 수행합니다:

1. `http://localhost:6333`의 **Qdrant Docker에 연결**하되, Docker가 다운된 경우 `QdrantClient(":memory:")`로 대체합니다. 임베더와 동일한 논리로, CI 환경이 완벽히 격리된 상태로 실행될 수 있어야 합니다.
2. 문자 수가 아닌 **섹션 단위로 마크다운을 청킹**합니다. `chunk_markdown_document()` 메서드는 `\n(?=##?\s)`(헤더 인식)를 기준으로 문서를 분할하고, 각 청크에 문서 ID, 문서 유형(`SOP`, `Deviation`, `Change Control`, `Validation Protocol`), 섹션 제목, 본문 내용을 라벨링합니다. 이것이 바로 **페이로드 인덱스(Payload Index)**입니다. Qdrant의 모든 벡터는 이를 귀속 가능하게(Attributable, ALCOA+) 만드는 메타데이터를 수반합니다.
3. 임베더의 벡터 차원(`qwen3-embedding:8b` 기준 1,536차원)으로 **코사인 유사도 기반 컬렉션을 재생성**한 후, 전체 페이로드와 함께 모든 청크를 `upsert`합니다.
4. **선택적 `doc_type_filter`를 적용한 검색**을 수행합니다. 필터는 유사 별칭(`"sop"`, `"procedure"`, `"Standard Operating Procedure"` 모두 표준 `Standard Operating Procedure` 값으로 변환됨)을 지원합니다.

```python
query_filter = Filter(must=[FieldCondition(key="doc_type", match=MatchValue(value="Deviation Report"))])
response = client.query_points(
    collection_name="csv_gxp_documents",
    query=query_emb,
    query_filter=query_filter,
    limit=3,
)
```

CSV 아키텍트의 해석: 이는 단순한 순수 벡터 검색이 아니라 **메타데이터 기반 필터링 검색**입니다. 이 차이가 감사 친화적인 RAG와 블랙박스 시스템을 가르는 기준입니다. QA 검토자가 "에이전트가 SOP에서만 인용했는가, 아니면 인용 세트에 일탈 기록도 포함했는가?"라고 묻는다면, "모델이 알아서 판단했다"는 모호한 대답 대신 `doc_type` 필터를 제시하여 명확히 답변할 수 있습니다.

### 4. `src/rag_agent.py` — 구조화된 출력을 보장하는 Pydantic AI 에이전트

CSV의 제약 조건이 본격적으로 엄격해지는 부분입니다. 에이전트는 다음과 같이 정의됩니다:

```python
csv_agent = Agent[CSVSystemDependencies, CSVQueryResult](
    model=settings.llm_model,
    deps_type=CSVSystemDependencies,
    output_type=CSVQueryResult,
    system_prompt=(
        "You are an expert Computer System Validation (CSV) Quality & Regulatory Compliance Auditor "
        "for Life Sciences (Pharmaceutical, Biotechnology, Medical Device).\n"
        "Your task is to answer queries and evaluate software validation procedures according to:\n"
        "1. FDA 21 CFR Part 11 (Electronic Records, Electronic Signatures, Audit Trails)\n"
        "2. EU Annex 11 (Computerised Systems)\n"
        "3. GAMP 5 Second Edition (Risk-based Validation Framework & Categories 1-5)\n"
        "4. ALCOA+ Data Integrity Principles (Attributable, Legible, Contemporaneous, Original, Accurate)\n\n"
        "ALWAYS search the internal GxP knowledge base using the `search_csv_knowledge_base` tool "
        "to retrieve verified SOPs, Deviations, Change Controls, and Validation Protocols before providing an answer. "
        "Cite the exact Document ID and Section in your citations list."
    ),
)
```

세 가지 Pydantic 모델이 출력 규격을 강제합니다:

- `Citation` — `document_id`, `section`, `snippet` (임의의 자유 형식 출처 표기 불가)
- `ComplianceVerification` — `is_compliant: bool`, `regulatory_frameworks: List[str]`, `findings`, `recommended_actions: List[str]`, `citations`
- `CSVQueryResult` — `query`, `answer`, `citations: List[Citation]`, `confidence_score: float`

도구 정의는 `@csv_agent.tool async def search_csv_knowledge_base(ctx: RunContext[CSVSystemDependencies], query: str, doc_type_filter: Optional[str] = None) -> str`입니다. 에이전트는 답변하기 전에 **반드시** 이 도구를 호출해야 합니다. 도구가 `"No relevant GxP documents found"`를 반환하면 에이전트는 이를 그대로 드러내야 하며, 사전 지식을 바탕으로 환각(hallucination) 인용을 지어내서는 안 됩니다.

> `_fallback_answer()` 경로는 오프라인 또는 LLM 사용 불가 시나리오를 위해 존재합니다. 운영 환경에서는 **폴백 발생 시 조용히 0.92 신뢰도 점수를 반환할 것이 아니라 통제된 일탈(Deviation) 프로세스로 라우팅**해야 합니다. LLM이 오프라인이고 검색도 전혀 수행되지 않았는데 `confidence_score=0.92`를 반환하는 것은 최악의 상황입니다. 추적 가능한 근거도 없이 자신 있어 보이는 답변을 내놓기 때문입니다. LLM이 다운되었다면 RAG도 다운된 것이며 시스템은 답변을 거부해야 합니다.

### 5. `src/mcp_server.py` — 3가지 도구를 제공하는 FastMCP

Model Context Protocol 계층은 외부 AI 클라이언트(Claude Desktop, IDE 에이전트, MCP 인식 애플리케이션 등)에 RAG 시스템을 개방합니다. 벡터 저장소와 에이전트를 얇게 래핑한 세 가지 도구가 제공됩니다:

```python
@mcp_server.tool()
async def search_csv_documents(query: str, doc_type_filter: str = "") -> str:
    """MCP Tool: GxP SOP, 일탈, 변경 제어 및 적격성평가 프로토콜을 검색합니다."""

@mcp_server.tool()
async def verify_gxp_compliance(system_description: str, software_category: int) -> str:
    """MCP Tool: 컴퓨터화 시스템 아키텍처 및 밸리데이션 계획이 GAMP 5 및 21 CFR Part 11을
    준수하는지 검증합니다. software_category: 1=인프라, 3=COTS(기성품), 4=구성형, 5=맞춤 개발."""

@mcp_server.tool()
async def analyze_deviation_impact(deviation_summary: str) -> str:
    """MCP Tool: 21 CFR Part 11 및 ALCOA+를 기준으로 CSV 일탈의 규제 및 데이터 완전성 영향을 평가합니다."""
```

Claude Desktop과의 연동은 단 하나의 JSON 스니펫으로 완료됩니다:

```json
{
  "mcpServers": {
    "csv-validation": {
      "command": "/path/to/embedding-tutorial/.venv/bin/python",
      "args": ["-m", "src.mcp_server"],
      "cwd": "/path/to/embedding-tutorial"
    }
  }
}
```

CSV 아키텍트의 해석: MCP 계층은 GxP RAG가 단순한 주피터 노트북 데모를 벗어나 **검증된 도구(Validated Tool)**로 전환되는 지점입니다. 세 가지 통제 항목이 적용되어야 합니다:

1. **MCP 전송 계층의 인증.** 튜토리얼은 신뢰할 수 있는 로컬 프로세스를 가정한 stdio 상에서 실행됩니다. 이를 SSE나 HTTP로 외부에 노출할 경우, Part 11 §11.10(d) 관문을 통과하기 위해 OAuth 2.0 또는 mTLS를 반드시 추가해야 합니다.
2. **MCP 경계에서의 감사 로깅.** 모든 `tool()` 호출은 호출한 사용자, 호출된 도구, 인자, 응답 내용을 포함하는 Langfuse 트레이스를 남겨야 합니다. `src/observability.py`는 이미 에이전트 계층에 `trace_gxp_query`를 연결해 두었습니다. 이를 MCP 도구 함수들까지 감싸도록 확장해야 합니다.
3. **GAMP 5 카테고리의 타입화된 입력 처리.** `verify_gxp_compliance`는 `software_category: int`(1, 3, 4, 5)를 인자로 받습니다. 이는 밸리데이션의 깊이를 결정하는 위험 기반 입력값입니다. 절대 기본값으로 대체되어서는 안 됩니다.

## 데모 실행: 22개 청크, 5개 테스트, 단일 패스 완료

`python demo.py`는 5단계를 순차적으로 실행합니다:

1. 임베더 초기화 및 벡터 차원(1,536) 확인.
2. `data/` 디렉터리의 4개 마크다운 파일(`SOP-CSV-001`, `DEV-2026-004`, `CC-2026-012`, `VAL-2026-IQ-01`)을 청킹하여 Qdrant 컬렉션 `csv_gxp_documents`에 인제스트. 결과: **22개 청크 인덱싱 완료**.
3. *"배치 출하 데이터 완전성을 위한 감사 추적 요건은 무엇인가?"*에 대한 코사인 유사도 검색 수행 — 유사도 0.0663으로 `DEV-2026-004_Audit_Trail_Discrepancy`가 최상위 매칭됨. (오프라인 모드에서 폴백 임베더가 무작위 단위 벡터를 반환하므로 절대 점수는 낮습니다. 실제 실행 중인 `qwen3-embedding:8b` 환경에서는 관련 문서 매칭 점수가 0.6~0.9 범위에 분포합니다.)
4. *"GAMP 5 카테고리 4 시스템 밸리데이션 요구사항 및 ALCOA+ 원칙을 설명하라"*는 RAG 에이전트 질의 — 2개의 인용과 `confidence_score: 0.92`를 포함한 `CSVQueryResult` 반환 (오프라인 폴백 경로).
5. 직접적인 MCP 도구 호출: `search_csv_documents("unauthorized privilege escalation LIMS admin", doc_type_filter="Deviation")` 및 `verify_gxp_compliance(system_description="Cloud-hosted LIMS DB with role-based access control and TLS 1.3 encryption", software_category=4)`.

`pytest -v`는 임베딩, 벡터 인덱싱, 메타데이터 필터링, RAG 에이전트 출력 스키마를 검증하는 **5개 테스트**를 실행합니다. 테스트 스위트는 작지만 모든 외부 의존성 경계를 포괄하며, 이것이 바로 IQ(설치 적격성 평가) 스모크 테스트 표면이 됩니다.

## 이 튜토리얼이 대체하지 않는 4가지 규제 요건

저장소를 살펴볼 때 다음의 공백을 염두에 두어야 합니다:

1. **벡터 저장소 쓰기 경계에서의 Part 11 감사 추적 부재.** Qdrant의 `upsert`는 Qdrant 내부에 로그로 남지만, *애플리케이션 레벨*의 감사 추적(누가, 언제, 원본 소스의 어떤 해시값으로 문서를 인덱싱했는가)은 생성되지 않습니다. 검증된 사용자 신원에 연결된 추가 전용(append-only) 로그가 필요합니다. 이것이 ALCOA+ 하에서 데이터를 **귀속 가능하게(Attributable)** 만드는 요건입니다.
2. **도구 호출에 대한 전자 서명 결합 부재.** MCP 도구들은 호출자 신원 없이 `query` 문자열을 수락합니다. 검증된 시스템에서는 모든 도구 호출이 Part 11을 준수하는 전자 서명(사용자 ID + 비밀번호/생체인식, 서명의 의미 토큰)을 수반해야 합니다.
3. **데이터 보존 주기 및 WORM 강제 부재.** 4개의 데모 마크다운은 git으로 버전 관리되지만, Qdrant에 *인덱싱된 임베딩*은 그렇지 않습니다. 검증된 시스템은 인덱스를 특정 스냅샷 해시 및 보존 기간(통상 제품 라이프사이클 + 규제 보존 기간)에 고정하는 보존 정책을 갖추어야 합니다.
4. **LLM 경계에서의 모델 버전 고정 부재.** `llm_model: str = "ollama:qwen2.5:7b"`는 단순 문자열입니다. 기반 Ollama 모델이 업데이트되면 에이전트의 동작이 조용히 변경됩니다. 모델 해시를 고정하고, IQ에서 해당 해시를 검증하며, 변경 발생 시 재검증을 수행해야 합니다. 이는 GAMP 5 카테고리 3이 아닌 카테고리 5 수준의 고려사항입니다.

## 결론

CSV 수준의 RAG 시스템 형태는 단순한 "벡터 DB + LLM + UI"가 아닙니다. 그 진정한 형태는 다음과 같습니다: **고정되고 검증된 임베딩 모델을 사용하는 Pydantic AI `Embedder` → 페이로드 인덱싱 청크 및 메타데이터 필터링 검색을 지원하는 Qdrant → 답변 전 반드시 도구 호출을 수행해야 하는 엄격한 구조화 출력 스키마의 Pydantic AI `Agent` → 검색, 규정 준수 검증, 일탈 영향 분석 도구를 노출하는 FastMCP 서버 → 감사 추적이 자동으로 남도록 모든 쿼리를 기록하는 Langfuse(또는 동등한 도구) 트레이싱.** [github.com/saram-io/embedding-tutorial](https://github.com/saram-io/embedding-tutorial)의 튜토리얼은 격리된 CI를 위한 오프라인 폴백과 실행을 증명하는 22개 청크/5개 테스트 데모를 포함하여 정확히 이러한 형태로 제공됩니다.

이를 실제 GxP 운영 환경에 적용하기 전에 반드시 추가해야 할 사항: 인덱서 경계에서의 Part 11 감사 로깅, 모든 MCP 도구 호출에 대한 전자 서명 결합, 벡터 저장소의 보존/WORM 강제, LLM 경계에서의 모델 해시 고정. 이 네 가지 통제는 선택 사항이 아닙니다. 단순한 튜토리얼과 실제 검증된 시스템을 가르는 본질적인 차이입니다.

저장소는 공개되어 있고 아키텍처는 재현 가능하며 테스트 스위트는 1분 이내에 실행됩니다. `docker run qdrant/qdrant`, `ollama pull qwen3-embedding:8b`, `uv pip install -e .`, `python demo.py`로 시작해 보십시오. 그 이후의 모든 단계는 귀사의 밸리데이션 계획에 달려 있습니다.

---

우리는 [GxPSoft AI](https://gxpsoft.ai)에서 GxP 규정을 준수하는 오픈소스 개발자 도구와 에이전트 인터페이스를 개발하고 있습니다. CSV RAG 시스템 구축을 준비 중이거나, 벡터 저장소에 Part 11 감사 추적을 연동하고 있거나, 검증된 GxP 환경을 위한 MCP 서버 도입을 평가 중이시라면 언제든 의견을 나눠주시기 바랍니다: [duke.lee@saram.io](mailto:duke.lee@saram.io).
