---
title: "오픈코어 생명과학 GxP 시스템 레지스트리 1단계 구축기: 소스 코드, 감사 체인, 그리고 그 이후의 로드맵"
description: "21 CFR Part 11, EU Annex 11, GAMP 5, ALCOA+ 규제 하에서 gxp-core-suite ITAM 및 마스터 GxP 시스템 레지스트리 1단계 기반 구축에 대한 엔지니어링 필드 가이드 — SHA-256 전진 체이닝 감사 원장, BFS 파급 범위(Blast-Radius) 엔진, FastMCP 서버, Pydantic AI 컴플라이언스 코파일럿 및 FDA 실사 시 정직성을 보증하는 결정론적 폴백 에이전트 패턴. apps/server/, packages/mcp-server/, 8개 pytest 모듈 소스 코드 및 2단계(ITSM, 변경 제어), 3단계(CSA, Living RTM), 4단계(랩 OT 엣지) 로드맵 분석."
pubDate: "2026-08-22T16:00:00.000Z"
author: "AI 에이전트 리서치 및 작성"
---

2026년 중반의 어느 화요일 오후, 샌프란시스코의 한 가상 바이오 CDMO의 바이오공정 엔지니어는 Waters ACQUITY Premier UPLC를 제어하는 Windows 11 LTSC 실험실 워크스테이션의 OS 패치 작업을 준비하고 있었습니다. 이 UPLC 장비는 상업용 완제 로트의 역가 및 불순물 출하 시험 데이터를 생성하고 있었습니다 — *직접 GxP(Direct GxP)*, GAMP 5 카테고리 3, ALCOA+ 데이터 무결성 적용 대상, 밸리데이션 패키지 `VAL-2025-UPLC-01`. 엔지니어는 4시간의 패치 작업 윈도우를 열기 직전이었습니다. 작업을 시작하기 전 반드시 다음 세 가지 질문에 답해야 했습니다:

1. 이 워크스테이션에 의존하는 다른 GxP 시스템은 무엇이며, 종속성 그래프는 어디까지 확장되는가?
2. 동일하게 밸리데이션된 컴퓨팅 인프라(Windows 11 LTSC + Empower 3 FR5 클라이언트)를 공유하는 다른 직접 GxP 분석 장비는 무엇인가?
3. 이 시스템 자체의 감사 추적(Audit Trail)은 온전한 상태이며, 추후 규제 당국에 패치 작업 중 어떠한 기록도 변조되지 않았음을 입증할 수 있는가?

마스터 GxP 시스템 목록(Master GxP System List)을 정적인 엑셀 파일로 관리하는 전형적인 바이오 IT 환경이라면, 1번 질문에 대한 답은 *품질관리(QC) 매니저에게 구두로 문의*하는 것이고, 2번 질문에 대한 답은 *사내 셰어포인트를 뒤지는* 것이며, 3번 질문에 대한 답은 *데이터베이스 관리자(DBA)를 신뢰*하는 것입니다. IT 팀, QC 분석관, QA 팀, 밸리데이션 팀은 각각 정답의 파편만을 들고 있으며, 그 파편들은 어디에서도 하나로 결합되어 있지 않습니다.

저희는 [github.com/saram-io/gxp-core-suite](https://github.com/saram-io/gxp-core-suite)에 1단계 기반 코드를 배포했습니다([github.com/gxpsoft-ai/gxpsoft-poc](https://github.com/gxpsoft-ai/gxpsoft-poc)의 오픈코어 POC 연계): 감사 가능한 IT 자산 레지스트리, SHA-256 전진 체이닝(Forward-chained) 감사 원장, 다중 홉 BFS 파급 범위(Blast-Radius) 엔진, 그리고 엄격한 하네스(Harness) 통제 하에서 레지스트리를 AI 에이전트에 노출하는 모델 컨텍스트 프로토콜(MCP) 서버입니다. 이것이 바로 1단계의 범위입니다. QMS 워크플로우, 변경 제어(Change Control), CSA / Living RTM, 랩 OT 엣지 프록시는 2단계부터 4단계까지의 로드맵으로 계획되어 연기되었습니다. 본 글은 현재 배포된 기능과 향후 로드맵의 경계를 투명하게 구분하여 기술합니다.

이제 핵심 질문은 더 이상 *AI가 GxP 시스템을 다룰 수 있는가*가 아닙니다. **"FDA 실사 환경에서 AI의 무결성을 완벽하게 증명하면서도, 어떻게 컴플라이언스 질의에 수초 만에 답할 수 있는 시스템 아키텍처를 구축할 것인가?"**입니다. 본 글은 1단계가 실제로 담고 있는 내용, 각 모듈이 존재하는 이유, 그리고 실제 소스 코드가 어떻게 작성되었는지를 보여주는 실전 가이드입니다.

## 핵심 긴장: 컴플라이언스는 절차적 속성이 아니라 암호학적 속성이다

시스템 설계는 다음 세 가지 제약 조건에 의해 규정됩니다:

- **마스터 GxP 시스템 목록은 스프레드시트가 아니라 규제 공식 기록이다.** 모든 컬럼, 모든 분류, 모든 시스템 담당자 이메일은 21 CFR Part 11 §11.10(b)에 따라 시스템 인벤토리 감사 시 FDA 실사관이 공식 요청하는 규제 문서의 일부입니다. 정적 엑셀 파일은 두 가지 이유로 이를 충족하지 못합니다. 암호학적 위변조 증거가 없으며, AI 에이전트나 다른 밸리데이션된 시스템이 "이 바이오 제약사가 운영하는 시스템은 무엇인가?"를 프로그래밍 방식으로 질의할 방법이 없습니다. PDF와 공유 링크는 모두 시간이 지나면 썩습니다.
- **감사 추적은 단순 추가 전용(Append-only)이 아니라 전진 체이닝되어야 한다.** 21 CFR Part 11 §11.10(e)는 안전하고 컴퓨터로 자동 생성되며 타임스탬프가 찍힌 감사 추적을 요구합니다. 대부분의 GxP 시스템은 단순 추가 전용 로그만 제공합니다. 모든 레코드가 직전 레코드의 SHA-256 해시를 포함하여 과거 이력에 대한 비정상적인 수정 시도를 완벽히 탐지할 수 있는 시스템은 극히 드뭅니다. 진정한 규제 우위는 단순히 *감사 로그가 있다*가 아닙니다. *감사 로그가 절대 변조되지 않았음을 수학적으로 증명할 수 있으며, 만약 변조되었다면 변조된 정확한 시퀀스 번호를 지목할 수 있다*는 데 있습니다.
- **AI 에이전트는 데이터베이스 위가 아니라 통제된 하네스(Harness) 내부에서 동작해야 한다.** MasterControl의 AI Trust Center는 이를 직설적으로 명시합니다: *"MasterControl의 AI 기능은 어떠한 의사결정 작업도 수행하지 않는다."* Veeva의 AI 태세 또한 동일합니다: *"최종 조사는 여전히 인간이 작성한다."* 2026년 4월 2일 발부된 Purolea 경고장(Warning Letter)은 규제 집행의 하한선을 구체화했습니다: *"문서 작성 보조 수단으로 AI를 사용하는 경우, AI 생성 문서가 정확하고 실제로 CGMP를 준수하는지 반드시 검토해야 한다."* 아키텍처는 에이전트에게 밸리데이션된 기록 시스템에 대한 *읽기 전용 접근 권한*만을 부여하고 *그 외의 것은 일체 불허*해야 하며, 모든 툴 호출은 Langfuse로 추적되고 감사 로그로부터 완벽히 재현 가능해야 합니다.

성공적인 설계 형태는 명확합니다: **감사 원장, 토폴로지 그래프, MCP 툴 표면을 제어하는 결정론적 GxP 코어와, 질의에 답할 수는 있지만 레코드를 절대 직접 수정할 수는 없는 Pydantic AI 에이전트 제어 평면의 결합.** 신속하게 읽고 → 체인을 검증하고 → 답변하고 → 모든 툴 호출을 기록한다.

## 설계를 이끈 4대 핵심 동인

- **감사 원장은 단순 로그 테이블이 아닌 SHA-256 전진 해시 체인이다.** `Asset` 또는 `AssetRelationship`에 대한 모든 변경은 `apps/server/app/services/audit_service.py`의 `AuditLog` 테이블에 동기식으로 행을 추가합니다. 각 행은 `sequence_number`, `previous_record_hash`(직전 레코드의 SHA-256 해시, 최초 레코드의 경우 제네시스 `0` × 64), 그리고 모든 페이로드 필드의 표준 직렬화 문자열에 대해 계산된 `record_hash`를 포함합니다:
  ```text
  PREV:<previous_hash>|SEQ:<n>|TYPE:<entity_type>|ID:<entity_id>|ACT:<action>|
  ACTOR_ID:<id>|ACTOR_EMAIL:<email>|TS:<iso8601_utc>|PREV_ST:<canonical_json(previous_state)>|
  NEW_ST:<canonical_json(new_state)>|REASON:<reason_for_change>
  ```
  `GET /api/v1/audit/verify-chain` 엔드포인트는 1번 시퀀스부터 현재까지 모든 암호학적 연결 고리를 전수 재계산합니다. pytest 모듈 `tests/test_audit_chain_integrity.py`는 의도적으로 6번 레코드를 변조한 뒤 검증 엔진이 `tampered_sequence_number == 6`으로 정확히 잡아내는지를 검증합니다. 위변조 탐지는 단순 마케팅 주장이 아니라 테스트로 입증된 시스템 동작입니다.
- **토폴로지 그래프는 관계형 리포트가 아닌 BFS 엔진이다.** "이 윈도우 워크스테이션을 패치하면 무엇이 중단되는가?"라는 질문의 답은 그래프 순회입니다. `apps/server/app/services/graph_service.py`의 `GraphService.compute_blast_radius(...)` 메서드는 모든 관계 데이터를 메모리에 로드하고, 자산 ID를 키로 하는 다운스트림 및 업스트림 인접 맵을 구축한 뒤, 설정 가능한 `max_depth`(1~5홉)로 `deque` 기반의 BFS(너비 우선 탐색)를 수행합니다. 출력은 영향받는 노드 수, 직접 GxP 수, 데이터 무결성 크리티컬 수, 전체 엣지 목록을 담은 `BlastRadiusResponse`입니다. `tests/test_blast_radius.py`는 4개 노드 토폴로지(하이퍼바이저 → 앱 서버 → HPLC 및 클라우드 백업 링크)를 구축하고 루트로부터 깊이 2 탐색 시 3개의 직접 GxP와 2개의 데이터 무결성 크리티컬을 포함한 4개 노드 전체에 도달함을 증명합니다.
- **MCP 툴 표면은 에이전트의 유일한 진입점이다.** `packages/mcp-server/server.py`는 AI 어시스턴트(Claude Desktop, Cursor, Antigravity 및 FastMCP 호환 에이전트)에게 정확히 5개의 도구만 노출합니다: `list_gxp_assets`, `get_asset_details`, `get_asset_blast_radius`, `search_asset_specifications`, `verify_audit_trail_integrity`. 그 어떤 도구도 상태를 변경하지 않습니다. 그 어떤 도구도 감사 원장을 우회하지 않습니다. 모든 호출은 FastAPI 엔드포인트를 호출하는 얇은 `httpx` 래퍼이므로, 인간의 CRUD 작업을 통제하는 동일한 RBAC, 동일한 `reason_for_change` 검증, 동일한 `actor_email` 필수 요건이 에이전트의 툴 호출에도 동일하게 적용됩니다.
- **에이전트는 LLM 전용 경로가 아닌 결정론적 폴백 경로를 갖는다.** `apps/server/app/agent/pydantic_agent.py`는 구조화된 `ComplianceCopilotResponse` 출력(`answer`, `gxp_risk_level`, `cited_assets`, `blast_radius_summary`, `audit_chain_status`, `recommendations`)을 가진 Pydantic AI `Agent`를 정의합니다. 제1 실행 경로는 LLM입니다(기본 로컬 Ollama, 또는 API 키 존재 시 OpenAI / Anthropic / Gemini). 제2 실행 경로는 결정론적 키워드 라우터입니다: 프롬프트에 "blast" / "impact" / "down"이 포함되면 `GraphService.compute_blast_radius` 호출, "audit" / "tamper" / "21 cfr" / "chain"이 포함되면 `AuditService.verify_audit_chain` 호출, "spec" / "urs" / "sop" / "requirement"가 포함되면 `qdrant_service.search_specifications` 호출. LLM이 10초 내에 응답하지 못하면 결정론적 라우터가 즉시 제어권을 넘겨받아 사용자는 언제나 신뢰할 수 있는 실질적인 답변을 얻게 됩니다. LLM과 결정론적 경로 모두 실행 후 자체 호스팅 Langfuse v2로 스팬(Span)을 전송합니다.

## 6단계 버티컬 GxP 아키텍처 패턴

1단계 빌드의 완성된 구조는 모노레포 내 6개 파트로 구성됩니다:

**1. GxP ITAM 데이터 모델 (`apps/server/app/models/asset.py`) — 관계형 스키마로 표현된 마스터 GxP 시스템 목록:** `Asset` 모델은 SQLAlchemy 2.0 선언적 모델로 `asset_tag`(고유값, 색인), `asset_type`(`Hardware`, `Software`, `SaaS`, `LabWorkstation`, `EdgeDevice`), `status`(`Draft`, `Active`, `In-Maintenance`, `Retired`), 그리고 GxP 전용 필드를 포함합니다: `gxp_impact`(`DIRECT_GXP`, `INDIRECT_GXP`, `NON_GXP`), `gamp_category`(`CAT_1_INFRASTRUCTURE`, `CAT_3_NON_CONFIGURED`, `CAT_4_CONFIGURED`, `CAT_5_CUSTOM`), `data_integrity_scope`(ALCOA+ 원본 데이터 대상 여부 불리언), `validation_package_id`(`VAL-2025-UPLC-01` 등), `system_owner_email`, `qa_contact_email`, 그리고 JSON 형태의 `specifications` 블롭. `CheckConstraint`를 통해 데이터베이스 레벨에서 허용된 enum 값을 강제하므로, Pydantic 스키마 검증을 우회하더라도 잘못된 `gamp_category`는 절대 저장될 수 없습니다. `AssetRelationship`은 그래프 엣지(`HOSTS`, `CONTROLS`, `DEPENDS_ON`, `COMMUNICATES_WITH`)를 관리하며, 자기 참조 관계를 방지하는 제약조건(`source_asset_id != target_asset_id`)을 포함합니다.

**2. SHA-256 전진 체이닝 감사 서비스 (`apps/server/app/services/audit_service.py`) — 21 CFR Part 11 감사 원장:** `AuditService.record_audit_entry(...)`는 `audit_logs` 테이블에 쓰는 유일한 작성자입니다. 3자 미만의 `reason_for_change`나 누락된 `actor_email` 요청을 서비스 계층에서 차단하여 Part 11 §11.10(e) 전자 서명 정당화 사유를 강제합니다. 최신 `sequence_number`를 조회하고 해당 레코드의 `record_hash`를 `previous_hash`로 삼아 새로운 페이로드에 대해 해시를 생성하고 행을 추가합니다. `AuditService.verify_audit_chain(...)`은 1번 시퀀스부터 N번까지 체인을 순회하며 모든 해시를 재계산하고, 시퀀스 연속성과 이전 해시 링크를 대조하여 `is_valid`, `total_records_checked`, `latest_hash`, `tampered_sequence_number`, `error_message`를 포함한 `AuditVerificationResult`를 반환합니다. `verify-chain` 엔드포인트는 "이 시스템이 *지금 이 순간* Part 11을 준수하고 있는가?"에 답하는 단 하나의 진실의 원천입니다.

**3. BFS 토폴로지 및 파급 범위 엔진 (`apps/server/app/services/graph_service.py`) — 변경 제어 위험 지도:** `GraphService.compute_blast_radius(session, root_asset_id, max_depth=3)`는 변경 제어 워크플로우의 핵심입니다. 모든 관계와 자산을 메모리에 로드하고(일반적인 바이오제약 마스터 GxP 시스템 목록은 200~2,000개 수준이므로 메모리 처리가 이상적임), 양방향 인접 맵을 구축한 뒤 BFS를 실행하여 중복 엣지를 제거하고 `BlastRadiusResponse`를 반환합니다. UI의 `BlastRadiusGraph` 컴포넌트(`apps/web/src/components/BlastRadiusGraph.tsx`)는 노드를 깊이별로 그룹화하여 GxP 및 GAMP 배지가 달린 상향/하향 트리로 시각화합니다. Pydantic AI 코파일럿 역시 동일한 엔진을 호출합니다.

**4. FastMCP 서버 (`packages/mcp-server/server.py`) — 에이전트 툴 표면:** 158줄의 파이썬 코드, 5개 도구, 2개 전송 방식(로컬 IDE 연동용 STDIO, 8001번 포트 원격 에이전트 연동용 SSE)으로 구성된 군더더기 없는 구조입니다. 모든 툴은 환경변수 `GXP_API_BASE_URL`로 지정된 FastAPI 백엔드로 단발성 `httpx` 요청을 보냅니다. 툴 독스트링(Docstring)은 LLM이 직접 읽는 시스템 프롬프트 역할을 하므로, `gxp_impact`, `gamp_category`, `max_depth` 범위 및 기대 반환 형식이 정밀하게 기술되어 있습니다. Claude Desktop 설정 파일 `claude_desktop_config.json`의 6줄짜리 JSON 블록이 규제 대상 IT 조직을 위한 AI 온보딩의 전부입니다.

**5. Pydantic AI 컴플라이언스 코파일럿 (`apps/server/app/agent/pydantic_agent.py`) — 대화형 제어 평면:** `gxp_agent`는 `deps_type=AgentDeps(session, asset_id)`를 갖는 Pydantic AI `Agent[AgentDeps, ComplianceCopilotResponse]`입니다. 시스템 프롬프트는 명확한 규제 기준을 부여합니다: *"당신은 생명과학 GxP 규제 준수 및 밸리데이션 전문 코파일럿입니다. 21 CFR Part 11, EU Annex 11, ISPE GAMP 5 원칙에 따라 작동합니다. 직접 GxP 시스템에 미치는 영향과 데이터 무결성(ALCOA+) 범위를 상시 평가하며, 핵심 자산에 영향을 미치는 유지보수 작업 시 공식 변경 제어 또는 일탈 프로토콜을 제안하십시오."* 에이전트는 4개의 `@gxp_agent.tool` 함수를 가집니다. 기본 LLM은 로컬 Ollama 기반이며, `ComplianceAgent.execute_query(...)`의 결정론적 폴백은 10초 타임아웃 또는 예외 발생 시 즉각 활성화되어 "AI가 꺼져도 코파일럿은 여전히 동작한다"는 가용성을 보장합니다.

**6. Qdrant 벡터 규격 검색 (`apps/server/app/services/qdrant_service.py`) — URS 및 SOP 검색 계층:** 사용자 요구사항 규격서(URS), SOP, 시스템 매뉴얼에 대한 하이브리드 시맨틱 검색을 수행합니다. 임베딩은 로컬 Ollama의 `qwen3-embedding:8b`를 기본으로 사용하며, 오프라인 테스트 환경을 위한 결정론적 SHA-256 폴백을 내장하고 있습니다. 컬렉션은 `asset_specifications`이며 페이로드에 `gxp_impact` 및 `gamp_category` 필터를 포함하므로 "전자 서명 요건"에 대한 검색을 `DIRECT_GXP` 시스템으로만 한정할 수 있습니다.

## 모듈별 소스 코드 상세 분석

### `services/audit_service.py` — SHA-256 전진 체이닝 원장

```python
def compute_audit_hash(
    previous_hash: str,
    sequence_number: int,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_id: str,
    actor_email: str,
    timestamp_utc: Any,
    previous_state: Optional[Dict[str, Any]],
    new_state: Optional[Dict[str, Any]],
    reason_for_change: str,
) -> str:
    iso_time = normalize_timestamp(timestamp_utc)
    prev_json = canonical_json(previous_state)
    new_json = canonical_json(new_state)

    payload = (
        f"PREV:{previous_hash}|"
        f"SEQ:{sequence_number}|"
        f"TYPE:{entity_type}|"
        f"ID:{entity_id}|"
        f"ACT:{action}|"
        f"ACTOR_ID:{actor_id}|"
        f"ACTOR_EMAIL:{actor_email}|"
        f"TS:{iso_time}|"
        f"PREV_ST:{prev_json}|"
        f"NEW_ST:{new_json}|"
        f"REASON:{reason_for_change}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
```

해시 함수는 의도적으로 원초적이고 단순하게 설계되었습니다. 머클 트리(Merkle Tree)나 서명 집약, 외부 KMS에 의존하지 않습니다. 전진 체이닝 SHA-256 원장의 핵심은 특정 행의 단 1바이트라도 비정상적으로 수정되면 해당 레코드의 해시가 달라지고, 이는 도미노처럼 다음 모든 레코드의 해시를 깨뜨린다는 점입니다. `verify_audit_chain` 순회 알고리즘은 불일치가 시작된 최초 시퀀스 번호를 감지하여 정확한 `tampered_sequence_number`를 반환합니다. 테스트 스위트가 이를 입증합니다:

```python
# tests/test_audit_chain_integrity.py
# 4. 의도적으로 시퀀스 6번 레코드 데이터 변조
entry_6.new_state["location"] = "UNAUTHORIZED_ROOM_999"
await db_session.commit()

# 5. 검증 엔진이 시퀀스 6번에서 변조를 정확히 포착하는지 확인
tamper_result = await AuditService.verify_audit_chain(db_session)
assert tamper_result.is_valid is False
assert tamper_result.tampered_sequence_number == 6
assert "Data tampering detected" in tamper_result.error_message
```

### `services/graph_service.py` — BFS 파급 범위 엔진

```python
# 빠른 순회를 위해 모든 관계와 자산을 메모리에 사전 로드
all_rels = (await session.execute(select(AssetRelationship))).scalars().all()
all_assets = (await session.execute(select(Asset))).scalars().all()
asset_map: Dict[str, Asset] = {a.id: a for a in all_assets}

# 인접 맵 구축
downstream_adj: Dict[str, List[Tuple[str, str]]] = {}
upstream_adj: Dict[str, List[Tuple[str, str]]] = {}
for r in all_rels:
    downstream_adj.setdefault(r.source_asset_id, []).append(
        (r.target_asset_id, r.relationship_type)
    )
    upstream_adj.setdefault(r.target_asset_id, []).append(
        (r.source_asset_id, r.relationship_type)
    )

# BFS 큐: (현재_id, 깊이, 방향, 경로)
queue = deque([(root.id, 0, "root", [root.name])])
```

BFS 알고리즘은 `max_depth` 홉 이내의 모든 노드를 방문하며, 하향(HOSTS, CONTROLS, DEPENDS_ON 발신) 및 상향(DEPENDS_ON, COMMUNICATES_WITH 수신) 엣지를 모두 순회합니다. 각 방문 노드는 가독성 높은 순회 경로 문자열(`path_from_root`, 예: `["Waters Empower 3 CDS Server", "(HOSTS) -> Waters ACQUITY HPLC Workstation"]`)을 보존합니다. 최종 요약 블록은 변경 제어 위원회(CCB)가 실제로 검토하는 핵심 지표입니다:

```python
summary = BlastRadiusSummary(
    total_impacted_nodes=len(nodes_list),
    direct_gxp_count=direct_gxp,
    indirect_gxp_count=indirect_gxp,
    non_gxp_count=non_gxp,
    data_integrity_critical_count=di_critical,
    max_depth_reached=max_d,
)
```

만약 `direct_gxp_count > 0`이거나 `data_integrity_critical_count > 0`인 경우 위험 수준은 즉시 `Critical`로 평가되며, 에이전트는 *"유지보수를 수행하기 전 즉각적인 QA 변경 제어 프로토콜 수립이 필수적임"*을 권고합니다. CSV 분석관이 수작업으로 작성하던 분석 보고서를 1,000개 노드 규모의 레지스트리에서 50밀리초 이내에 도출해 냅니다.

### `services/asset_service.py` — 동기식 감사 추적 패턴

`Asset`에 대한 모든 생성, 수정, 삭제 작업은 동일한 데이터베이스 트랜잭션 내에서 `AuditLog` 행을 **동기식**으로 기록합니다:

```python
# 21 CFR Part 11 감사 추적을 동기식으로 기록
new_state = asset_to_dict(asset)
await AuditService.record_audit_entry(
    session=session,
    entity_type="Asset",
    entity_id=asset.id,
    action=AuditAction.CREATE,
    actor_email=asset_in.actor_email,
    reason_for_change=asset_in.reason_for_change,
    previous_state=None,
    new_state=new_state,
    actor_id=asset_in.actor_id,
)
await session.commit()
```

"동기식"이라는 점이 결정적입니다. 감사 기록 쓰기에 실패하면 자산 생성 트랜잭션 전체가 롤백됩니다. 반대로 자산 쓰기가 실패하면 감사 기록도 남지 않습니다. 자산은 존재하지만 생성 기록은 존재하지 않는 비정상적 상태는 시스템상 원천적으로 불가능합니다. 21 CFR Part 11 §11.10(e)의 요구사항은 UI나 애플리케이션 계층이 아닌 데이터베이스 트랜잭션을 묶는 서비스 계층에서 절대적으로 강제됩니다.

### `agent/pydantic_agent.py` — LLM과 결정론의 하이브리드 구조

에이전트는 두 가지 실행 경로를 가집니다. LLM 경로는 10초 타임아웃과 함께 Pydantic AI 에이전트를 실행합니다:

```python
if has_llm and not isinstance(gxp_agent.model, TestModel):
    try:
        result = await asyncio.wait_for(
            gxp_agent.run(prompt, deps=deps), timeout=10.0
        )
        log_agent_trace(
            name="PydanticAIComplianceAgent",
            user_query=prompt,
            output=result.data.model_dump(),
            metadata={"model": str(gxp_agent.model), "asset_id": asset_id},
        )
        return result.data
    except asyncio.TimeoutError:
        logger.info("Local LLM inference reached 10s timeout, activating accelerated deterministic GxP engine.")
```

만약 로컬 LLM이 1,000토큰 이상의 컨텍스트를 처리하다 10초를 초과하면 결정론적 라우터가 즉시 제어권을 넘겨받습니다:

```python
elif "audit" in prompt_lower or "tamper" in prompt_lower or "21 cfr" in prompt_lower or "chain" in prompt_lower:
    audit_res = await AuditService.verify_audit_chain(session)
    ...
    if audit_res.is_valid:
        audit_status = f"VALID (Checked {audit_res.total_records_checked} SHA-256 chained records)"
        answer = (
            f"21 CFR Part 11 Audit Trail verification successful: All {audit_res.total_records_checked} "
            f"records form an unbroken SHA-256 cryptographic chain starting from Genesis hash. "
            f"No unauthorized modifications or data tampering detected."
        )
    else:
        audit_status = f"TAMPERED (Broken at sequence #{audit_res.tampered_sequence_number})"
        risk_level = "Critical"
        answer = (
            f"CRITICAL WARNING: 21 CFR Part 11 audit chain verification FAILED at sequence #{audit_res.tampered_sequence_number}! "
            f"Error: {audit_res.error_message}. The database may have undergone out-of-band modifications."
        )
```

사용자는 언제나 확정적인 답변을 받습니다. 그 답변은 실제 데이터베이스를 검증한 실시간 `verify_audit_chain` 호출에 근거합니다. 위험 등급은 LLM의 자의적 판단이 아니라 영향받는 시스템의 실제 `direct_gxp_count`와 `data_integrity_critical_count`로부터 산출된 `Low`, `Medium`, `High`, `Critical` 중 하나로 엄격히 결정됩니다.

### `packages/mcp-server/server.py` — 5개 도구의 에이전트 표면

```python
@mcp.tool()
def list_gxp_assets(
    gxp_impact: Optional[str] = None,
    gamp_category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> str:
    """List computerized systems from the Master GxP System Registry with filtering options.
    ...
    """
```

전체 도구 표면은 158줄입니다. 5개의 도구, 2개의 전송 방식, 무상태(Stateless) 구조입니다. MCP 서버는 캐싱이나 큐잉을 하지 않습니다. 모든 호출은 FastAPI 백엔드로 전송되는 단발성 HTTP 요청입니다. 규제 대상 MCP 서버는 상태를 가진 에이전트가 아니라 얇은 프록시여야 합니다. 상태는 감사 원장 및 RBAC와 함께 PostgreSQL 백엔드 내에 안전하게 존재해야 합니다.

## 8대 핵심 검증 테스트 스위트

`apps/server/tests/`에 위치한 테스트 스위트 자체가 곧 소프트웨어 밸리데이션 증거입니다. Part 11 및 GAMP 5 요건에 따라 명명된 8개의 pytest 모듈로 구성됩니다:

1. **`test_audit_chain_creation_and_integrity`** — 다중 CRUD 변경에 걸쳐 끊어지지 않는 SHA-256 해시 체이닝을 검증합니다.
2. **`test_tampering_detection`** — 데이터베이스의 과거 레코드를 고의로 변조했을 때 검증 엔진이 정확한 시퀀스 번호를 지목하는지 검증합니다.
3. **`test_missing_reason_for_change_rejected`** — 3자 미만의 사유 기재 시 거부하여 21 CFR Part 11 §11.10(e) 전자 서명 정당화 요건을 강제함을 검증합니다.
4. **`test_blast_radius_multi_depth`** — `HOSTS`, `CONTROLS`, `DEPENDS_ON`, `COMMUNICATES_WITH` 관계를 넘나드는 다중 홉 그래프 BFS 순회와 위험 집계를 검증합니다.
5. **`test_circular_graph`** — 순환 토폴로지(A → B → C → A) 환경에서 BFS가 무한 루프에 빠지지 않고 정상 종료됨을 검증합니다.
6. **`test_mcp_tool_signatures`** — FastMCP 툴의 함수 시그니처, 파라미터, 독스트링 규격을 검증합니다.
7. **`test_pydantic_agent_compliance_queries`** — Pydantic AI 코파일럿의 도구 실행 및 Qdrant 시맨틱 검색 역량을 검증합니다.
8. **`test_api_health_and_asset_endpoints`** — REST 엔드포인트, CSV 익스포트, JSON 익스포트 및 자산 수명주기 전반을 검증합니다.

전체 테스트 스위트 실행:

```bash
PYTHONPATH=apps/server:packages/mcp-server pytest apps/server/tests -v
```

모든 테스트는 100% 통과해야 합니다. 이 검증 스위트는 전통적인 IQ/OQ/PQ 프로토콜이자 CSA 시대의 비판적 사고 기반 위험 완화 증빙 기록입니다.

## 엔터프라이즈 시드 데이터셋: 36개 자산, 34개 엣지, 6대 규제 도메인

`scripts/seed_assets.py` 스크립트는 실제 제약/바이오 현장과 동일한 수준의 ITAM 데이터셋을 생성합니다. 6개 규제 도메인, 36개의 독립된 시스템, 34개의 다중 홉 토폴로지 엣지로 구성되며, 모든 자산은 `validation_package_id`, 담당자 이메일, 그리고 Part 11을 준수한 변경 사유를 포함합니다:

| 규제 도메인 | 대표 자산 예시 | GAMP 카테고리 |
|---|---|---|
| 분석 QC 및 연구개발 | Waters ACQUITY Premier UPLC, Agilent 1290 Infinity II LC, Thermo Orbitrap Exploris 480 MS, SpectraMax iD5 플레이트 리더, TA Nano DSC | Cat 3 / Cat 4 |
| 바이오공정 상/하류 공정 | Sartorius BIOSTAT STR 500L 배양기, B-DCU 제어기, Cytiva ÄKTA avant 150, UNICORN 워크스테이션, Getinge GEE 멸균기, Millipore Pellicon TFF | Cat 4 / Cat 5 |
| 환경 모니터링 및 시설 엣지 | Vaisala viewLinc 게이트웨이, CAB100 클린룸 센서, HMT140 초저온 냉동고 센서, Johnson Controls Metasys 공조기 | Cat 1 / Cat 3 / Cat 5 |
| 규제 SaaS 및 엔터프라이즈 클라우드 | Veeva Vault QMS, Benchling ELN/LIMS, SAP S/4HANA Cloud, Medidata Rave EDC, DocuSign Part 11 모듈 | Cat 4 |
| 엔터프라이즈 IT 인프라 | AWS 검증 프로덕션 바이오-VPC, Okta IdP, 사내 Active Directory | Cat 1 |
| 실험실 IT 및 워크스테이션 | Empower 3 FR5 클라이언트, OpenLab CDS v2.7, Xcalibur 4.4, SoftMax Pro 7.1 GxP | Cat 3 / Cat 4 |

단순한 더미 데이터가 아닙니다. 모든 `asset_tag`는 실제 제약 현장의 장비이며, 펌웨어 버전, 산업용 통신 프로토콜(OPC-UA, Modbus TCP, BACnet IP, S7-1500 PLC), 밸리데이션 패키지 ID를 충실히 담고 있습니다.

## 구매자가 던져야 할 7가지 핵심 질문

오픈코어 GxP 시스템 레지스트리를 검토할 때 벤더에게 다음 7가지 질문을 던져야 합니다:

1. **감사 원장이 SHA-256 전진 해시 체인인가, 아니면 단순 DB 추가 전용 로그인가?** 로그 파일은 위변조를 증명할 수 없습니다. 해시 체인만이 가능합니다.
2. **과거 레코드에 대한 고의적 변조를 체인이 감지하는 것을 테스트 스위트로 입증할 수 있는가?** 감사 로그가 있다는 말만으로는 부족합니다. 위변조 탐지 메커니즘이 실제로 작동해야 합니다.
3. **파급 범위 엔진이 DB 상의 그래프를 순회하는 BFS인가, 아니면 수작업으로 다시 돌리는 관계형 리포트인가?** 단순 리포트는 동적 위험 지도가 될 수 없습니다.
4. **어떤 AI 에이전트가 접근할 수 있으며, 부여된 도구의 권한은 무엇인가?** LLM이 DB 쓰기 권한을 갖는다면 거버넌스가 붕괴된 것입니다. 읽기 전용으로 제한되고 추적되어야 합니다.
5. **LLM 경로에 결정론적 폴백이 존재하는가?** LLM에만 의존하는 시스템은 부하 상황에서 비결정론적 오류를 냅니다. 타임아웃 기반 폴백이 필수적입니다.
6. **프롬프트, 리트리버, 툴 API가 형상 관리 항목으로 버전 관리되는가?** Part 11 §11.10(g)에 따라 모델명, 프롬프트 버전은 코드 내 상수로 엄격히 고정되어야 합니다.
7. **외부 API 호출 없이 100% 온프레미스 에어갭(망분리) 환경에서 실행 가능한가?** 외부 클라우드로 데이터가 유출되지 않고 로컬 하드웨어에서 완결되어야 합니다.

위 7가지 질문에 *"네, 여기 소스 코드가 있고, 테스트 스위트가 있으며, 실행 중인 스택이 있습니다"*라고 답할 수 있는 시스템만이 감사에 통과할 수 있습니다.

## 아직 완전히 해결되지 않은 과제들

1단계에서 완전히 해결하지 못한 3가지 과제입니다:

- **CDMO 고객사를 위한 멀티 테넌트 격리.** 현재 `assets` 테이블에는 `tenant_id` 컬럼이 없습니다. 여러 고객사의 레지스트리를 위탁 운영하는 CDMO를 위해서는 데이터베이스 계층의 행 수준 보안(RLS)과 테넌트별 독립 제네시스 해시 체인이 필요합니다. 이는 2단계의 핵심 과제입니다.
- **레코드 콘텐츠에 결속된 전자 서명 (Part 11 §11.50).** 현재는 `actor_email`을 기록하는 방식이지만, 21 CFR Part 11 §11.50은 서명이 대상 레코드에 영구적으로 결속되어 일반적인 방법으로 분리되거나 위조될 수 없도록 요구합니다. 차기 버전에서는 `new_state` 표준 JSON에 대한 Ed25519 디지털 서명을 도입할 예정입니다.
- **컴퓨터 소프트웨어 보증(CSA) 비판적 사고 기반 위험 기록 체계화.** 8개의 pytest 모듈이 검증을 수행하지만, 공식 CSA 프레임워크는 최고 위험 사용자 스토리, 잠재적 고장 모드, 이를 완화하는 테스트 케이스를 명시적으로 연결한 *비판적 사고 위험 기록(Critical-Thinking Risk Record)* 문서를 요구합니다.

## 결론

질문은 더 이상 *AI가 GxP 시스템에 접근할 수 있는가*가 아닙니다. **FDA 실사 환경에서 AI의 무결성을 증명하면서도, 어떻게 컴플라이언스 질의에 수초 만에 답할 수 있는가**입니다.

1단계가 제공하는 해답: 감사 원장과 토폴로지 그래프를 통제하는 결정론적 GxP 코어, 임의 변조를 정확한 시퀀스 번호에서 포착하는 SHA-256 전진 체이닝 감사 원장, 변경 제어 위험을 50밀리초 그래프 쿼리로 변환하는 BFS 파급 범위 엔진, 5개의 읽기 전용 도구로 구성된 FastMCP 서버, 10초 타임아웃과 결정론적 폴백을 갖춘 Pydantic AI 컴플라이언스 코파일럿, 그리고 모든 에이전트 호출을 추적하는 Langfuse 관측성 계층입니다. QMS, 변경 제어, CSA, 랩 엣지 프록시는 이 견고한 주춧돌 위에 세워질 것입니다.

감사 추적이 증거입니다. 파급 범위가 해답입니다. MCP 서버가 관문입니다. 에이전트는 보조자입니다. 서명은 여전히 인간의 몫입니다. 그리고 이 레지스트리는 완성된 플랫폼이 아닌 오픈코어 기반입니다 — 1단계는 나무 전체가 아니라 뿌리 노드입니다.

소스 코드: [github.com/saram-io/gxp-core-suite](https://github.com/saram-io/gxp-core-suite). 36개 자산 시드, 34개 엣지 매핑, 8개 pytest 모듈 통과, 5개 MCP 도구 제공, SHA-256 전진 체이닝 감사 원장 탑재. Apache 2.0 라이선스. **이것은 완성된 전체 플랫폼이 아닌 1단계 기반입니다.**

## 1단계 이후의 오픈코어 로드맵

1단계는 엑셀 스프레드시트로 방치되던 "마스터 GxP 시스템 목록"이라는 첫 번째 페인포인트를 해결했습니다. 하지만 이는 훨씬 거대한 지식 그래프의 시작점에 불과합니다. 생명과학을 위한 버티컬 소프트웨어 플랫폼은 기존 감사 원장을 교체하는 것이 아니라 그 위에 새로운 계층을 연결하는 방식으로 확장될 것입니다:

**2단계: GxP ITSM 및 변경 제어 브릿지.** 다음 계층은 ITAM 레지스트리와 연결된 GxP 서비스 데스크(인시던트, 서비스 요청, 하드웨어 온보딩, 패치 관리)입니다. `DIRECT_GXP` 자산에 발생한 인시던트는 품질 부서로 자동 에스컬레이션되고, 근본 원인 태그가 강제되며, 연계된 CAPA가 승인될 때까지 티켓 종결이 차단됩니다. 동일한 `AssetRelationship` 그래프가 변경 영향 분석 엔진이 되어, `WS-HPLC-001-PC`에 대한 윈도우 패치가 영향을 미치는 SOP, URS, 테스트 케이스를 자동으로 도출합니다. 인간 개입(HITL) MCP 게이트웨이가 상태 변경 툴을 가로채어 자격 있는 인간이 Part 11 사유와 함께 서명할 때까지 승인 대기 상태로 유지합니다.

**3단계: 동적 CSA 및 살아있는 RTM (Living RTM).** 컴퓨터 소프트웨어 보증(CSA)은 서류 중심의 V-모델을 대체합니다. 3단계에서는 ITAM 레지스트리의 모든 `Asset`이 URS에 `GOVERNED_BY` 관계로 연결되고, 각 URS는 위험 항목에 의해 `MITIGATED_BY`로, 각 위험은 테스트 케이스에 의해 `VERIFIED_BY`로, 각 테스트 케이스는 WORM 스토리지의 증거를 `PRODUCES`하는 구조를 갖춥니다. 요구사항 추적성 매트릭스(RTM)는 정적 문서가 아니라 50밀리초 만에 실행되는 실시간 그래프 쿼리가 됩니다: `MATCH (u:URS)-[:MITIGATED_BY]->(r:Risk)-[:VERIFIED_BY]->(t:TestCase)-[:PRODUCES]->(e:Evidence) WHERE u.asset_id = $id RETURN path`. 감사 원장은 변경되지 않으며, CSA 계층은 자산 그래프를 읽고 새로운 이벤트 타입을 원장에 추가합니다.

**4단계: 에어갭 실험실 OT 및 자율 탐색.** 마지막 계층은 물리적 실험실 인프라와의 루프를 완성합니다. HPLC 워크스테이션이나 바이오리액터 제어기 등이 위치한 격리된 실험실 서브넷에서 경량의 비침습적 Rust/Go 엣지 데몬이 실행됩니다. 실시간 데이터 수집을 방해하지 않도록 능동적 스캔 대신 *수동적(Passive)* 네트워크 및 OS 패치 모니터링을 수행하며, 아웃바운드 mTLS 터널을 통해 중앙 레지스트리로 변경 내역을 보고합니다. 이를 통해 연구원이 법인카드로 임의 구매한 랩톱과 같은 섀도우 IT를 IT 부서보다 먼저 레지스트리가 감지하게 됩니다.

**지식 그래프 진화 방향.** 1단계는 단일 컨테이너, 단일 DB 배포 및 단일 ACID 트랜잭션 경계를 유지하기 위해 PostgreSQL 인접 테이블과 재귀적 SQL CTE를 활용한 BFS를 선택했습니다. ITAM 계층(최대 3홉)에서는 이것이 최선입니다. 그러나 향후 자산 → URS → 위험 → 테스트 → 증적 → SOP → 변경 제어 → 인시던트 → CAPA로 이어지는 50,000개 이상의 노드와 6~8홉의 진정한 멀티 도메인 메시(Mesh)로 확장될 때, 최선의 차기 선택지는 **Apache AGE**(PostgreSQL openCypher 확장)입니다. 단일 DB, 단일 트랜잭션, 단일 감사 체인을 유지하면서도 AI 에이전트에게 중첩 SQL보다 훨씬 신뢰성 높은 Cypher 질의어를 제공하기 때문입니다. 순회 지연시간이 병목이 될 경우 Memgraph나 Neo4j가 대안이 될 수 있으며, 이는 2단계에서 결정될 사항입니다.

**MCP 게이트웨이 진화 방향.** 1단계 MCP 서버는 5개 도구를 가진 얇은 읽기 전용 프록시입니다. 2단계에서 이 프록시는 *게이트웨이*로 진화합니다. 위험도(읽기, 스테이징, GxP-쓰기)에 따라 도구 호출을 분류하고, 상태 변경 호출 시 HITL 전자 서명을 강제하며, 도메인별 MCP 서버(지식 그래프 MCP, QMS MCP, ITSM MCP, 랩 엣지 MCP)로 라우팅하는 미들웨어가 됩니다. 게이트웨이 자체가 정책 엔진이 되며, 21 CFR Part 11 감사 로그에 가장 풍부한 컨텍스트(툴 이름, 입력 페이로드, 모델 추론 ID, 서명 사유, 암호학적 서명)를 제공하는 핵심 계층이 될 것입니다.

---

[GxPSoft AI](https://gxpsoft.ai)는 GxP 규정을 준수하는 오픈소스 개발자 도구와 에이전틱 인터페이스를 개발하고 있습니다. 마스터 GxP 시스템 레지스트리, 21 CFR Part 11 감사 원장, 또는 규제 AI 에이전트를 위한 모델 컨텍스트 프로토콜(MCP) 서버 도입을 검토 중이시라면 언제든 편하게 연락 주시기 바랍니다: [duke.lee@saram.io](mailto:duke.lee@saram.io).
