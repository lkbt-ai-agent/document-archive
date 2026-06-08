# 루트 scripts 필수 스크립트 정리 및 문서화 계획

## 대상 TODO

`plan/todos.md` high 0: 프로젝트 루트 `scripts` 폴더의 스크립트들의 역할 및 사용 여부 검증.

반영할 작성자 코멘트:

- `required` 분류에 해당하는 스크립트만 남깁니다.
- 나머지 `scripts` 폴더 하위 파일은 삭제하는 방향으로 계획합니다.
- 남기는 required 스크립트를 설명하는 문서를 `architecture`에 추가하거나 기존 문서를 수정합니다.

## 결론

현재 코드 기준으로 `scripts/`에 남길 파일은 다음 2개입니다.

| 파일 | 분류 | 남기는 이유 |
| --- | --- | --- |
| `scripts/start_local_ai_provider.py` | `required` | `start_archive_services.sh`가 OCR, embedding, generation 로컬 AI provider를 시작할 때 직접 호출합니다. |
| `scripts/local_ai_common.py` | `required` | `start_local_ai_provider.py`가 사용하는 공통 설정 모듈입니다. 단독 실행 스크립트는 아니지만 required 스크립트의 런타임 의존성입니다. |

삭제 대상은 다음입니다.

| 파일/디렉터리 | 처리 | 이유 |
| --- | --- | --- |
| `scripts/local_ai_health_check.py` | 삭제 | 서비스 시작 필수 경로에서 호출되지 않습니다. 진단용 스크립트는 이 TODO의 목표와 맞지 않으므로 남기지 않습니다. |
| `scripts/verify_local_ai.py` | 삭제 | 실제 provider 검증용 보조 스크립트이지만 required가 아니므로 제거합니다. |
| `scripts/__pycache__/` | 삭제 | Python 실행 부산물입니다. |

## 배경

현재 `scripts/`에는 로컬 llama.cpp provider 실행과 검증을 위한 파일이 섞여 있습니다.

```text
scripts/
  local_ai_common.py
  start_local_ai_provider.py
  local_ai_health_check.py
  verify_local_ai.py
  __pycache__/
```

하지만 실제 서비스 통합 시작 스크립트인 `start_archive_services.sh`는 다음 파일만 호출합니다.

```sh
python3 scripts/start_local_ai_provider.py ocr
python3 scripts/start_local_ai_provider.py embedding
python3 scripts/start_local_ai_provider.py generation
```

`start_local_ai_provider.py`는 내부에서 `local_ai_common.py`를 import합니다. 따라서 현재 프로젝트의 서비스 시작 흐름에서 required로 볼 수 있는 것은 이 두 파일뿐입니다.

## 목표

- `scripts/`를 서비스 시작에 필요한 최소 파일만 남긴 구조로 정리합니다.
- 진단용/검증용 스크립트는 삭제하고, 해당 스크립트를 언급하는 문서도 정리합니다.
- 남기는 required 스크립트의 역할, 입력 env, 실행 방식, 실패 조건을 `architecture` 문서에 명확히 적습니다.
- `scripts/__pycache__/` 같은 실행 부산물이 다시 들어오지 않도록 ignore 규칙을 확인합니다.

## 비목표

- 로컬 AI 모델이나 provider 구성을 변경하지 않습니다.
- `start_archive_services.sh`의 전체 서비스 시작 정책을 재설계하지 않습니다.
- 삭제되는 진단 스크립트의 기능을 다른 새 스크립트로 대체하지 않습니다.
- Python 패키지 의존성을 추가하지 않습니다.

## 유지 대상 상세

### `scripts/start_local_ai_provider.py`

역할:

- `ocr`, `embedding`, `generation` 중 하나의 역할을 받아 해당 llama.cpp `llama-server` 명령을 구성합니다.
- 역할별 모델 경로, base URL, alias, context size를 env와 `config/ai_providers.json`에서 읽습니다.
- `ocr` 역할에는 `--mmproj`를 추가합니다.
- `embedding` 역할에는 `--embedding`, batch size, ubatch size, pooling 옵션을 추가합니다.
- `--print-only`가 있으면 실행하지 않고 명령만 출력합니다.
- `--print-only`가 없으면 `subprocess.call(command)`로 `llama-server`를 실행합니다.

현재 직접 참조:

- `start_archive_services.sh`
- `apps/backend/README.md`
- `architecture/local_ai_models.md`

필수 env:

- `LLAMA_CPP_SERVER_BIN`
- `LLAMA_CPP_OCR_BASE_URL` 또는 fallback `LLAMA_CPP_BASE_URL`
- `LLAMA_CPP_EMBEDDING_BASE_URL` 또는 fallback `LLAMA_CPP_BASE_URL`
- `LLAMA_CPP_GENERATION_BASE_URL` 또는 fallback `LLAMA_CPP_BASE_URL`
- `LOCAL_AI_OCR_MODEL_PATH`
- `LOCAL_AI_OCR_MMPROJ_PATH`
- `LOCAL_AI_EMBEDDING_MODEL_PATH`
- `LOCAL_AI_GENERATION_MODEL_PATH`

선택 env:

- `LOCAL_AI_OCR_MODEL_NAME`
- `LOCAL_AI_EMBEDDING_MODEL_NAME`
- `LOCAL_AI_GENERATION_MODEL_NAME`
- `LOCAL_AI_OCR_CTX_SIZE`
- `LOCAL_AI_EMBEDDING_CTX_SIZE`
- `LOCAL_AI_GENERATION_CTX_SIZE`
- `LOCAL_AI_EMBEDDING_BATCH_SIZE`
- `LOCAL_AI_EMBEDDING_UBATCH_SIZE`
- `LOCAL_AI_EMBEDDING_POOLING`

### `scripts/local_ai_common.py`

역할:

- 저장소 루트, `config/ai_providers.json`, `.env.local-ai` 경로를 제공합니다.
- `.env.local-ai`를 읽어 process env에 기본값으로 반영합니다.
- provider base URL과 model alias를 해석합니다.
- 필수 파일 env가 실제 파일을 가리키는지 확인합니다.
- base URL에서 `llama-server` 실행에 필요한 host/port를 추출합니다.

유지 이유:

- 단독 실행 파일은 아니지만 `start_local_ai_provider.py`의 required dependency입니다.
- 공통 로직을 `start_local_ai_provider.py`에 inline하면 실행 스크립트가 길어지고 설정 해석 책임이 섞입니다.

주의:

- `.env.local-ai` parser는 단순 `KEY=VALUE` 형식만 지원합니다.
- `export KEY=VALUE`, inline comment, 복잡한 escaping은 지원하지 않는 것으로 문서화합니다.

## 삭제 대상 상세

### `scripts/local_ai_health_check.py`

삭제 이유:

- 서비스 시작 required 경로에서 호출되지 않습니다.
- `/health` 확인은 유용하지만 이 TODO의 방향은 required만 남기는 것입니다.
- 남겨두면 `scripts/`의 목적이 다시 "실행 + 진단 도구 모음"으로 넓어집니다.

후속 처리:

- `architecture/local_ai_models.md`의 `python3 scripts/local_ai_health_check.py` 예시를 제거합니다.
- `apps/backend/README.md`의 같은 예시를 제거합니다.
- 필요하면 문서에서 "서버 상태는 각 provider 로그와 backend 오류 메시지로 확인" 정도로만 안내합니다.

### `scripts/verify_local_ai.py`

삭제 이유:

- OCR/embedding/generation 실제 요청 검증은 보조 진단 기능입니다.
- required 시작 흐름에는 필요하지 않습니다.
- 샘플 이미지 경로와 timeout 등 별도 유지보수 포인트를 만듭니다.

후속 처리:

- `architecture/local_ai_models.md`의 `verify_local_ai.py` 명령과 설명을 제거합니다.
- `apps/backend/README.md`에 `verify_local_ai.py` 언급이 있으면 제거합니다.

### `scripts/__pycache__/`

삭제 이유:

- Python 실행 부산물입니다.
- source tree와 git에 포함되면 안 됩니다.

후속 처리:

- `.gitignore`에 `__pycache__/`, `*.py[cod]` 패턴이 있는지 확인합니다.
- 없으면 추가합니다.

## 문서화 방향

새 문서를 추가하기보다 기존 `architecture/local_ai_models.md`를 수정하는 편이 적절합니다.

이유:

- required 스크립트는 로컬 AI 모델 실행과 직접 관련됩니다.
- 이미 `architecture/local_ai_models.md`가 `scripts/start_local_ai_provider.py`의 역할, 기본 context, 시작 명령을 설명하고 있습니다.
- 별도 문서를 추가하면 로컬 AI 실행 설명이 분산됩니다.

필요 수정:

- `architecture/local_ai_models.md`
  - `scripts/start_local_ai_provider.py`와 `scripts/local_ai_common.py`만 required로 설명합니다.
  - `local_ai_health_check.py`, `verify_local_ai.py` 명령과 설명을 제거합니다.
  - `.env.local-ai` 형식 제한을 추가합니다.
  - `--print-only` 사용 목적을 유지합니다.
  - `start_archive_services.sh`가 이 스크립트를 호출한다는 점을 명시합니다.
- `apps/backend/README.md`
  - 삭제되는 `local_ai_health_check.py` 예시를 제거합니다.
  - 로컬 AI provider 시작 명령은 유지합니다.
- 필요 시 `README.md`
  - `scripts` 디렉터리가 "로컬 AI 실행 스크립트"를 담는다고 간단히 설명합니다.

## 구현 작업

### 1. 현재 참조 목록 확인

삭제 전 참조 위치를 확인합니다.

```bash
rg -n "start_local_ai_provider|local_ai_health_check|verify_local_ai|local_ai_common|scripts/" README.md architecture apps start_archive_services.sh stop_archive_services.sh
```

현재 확인된 핵심 참조:

- `start_archive_services.sh`: `start_local_ai_provider.py` 직접 호출.
- `apps/backend/README.md`: `start_local_ai_provider.py`, `local_ai_health_check.py` 언급.
- `architecture/local_ai_models.md`: `start_local_ai_provider.py`, `local_ai_health_check.py`, `verify_local_ai.py` 언급.

### 2. 삭제 대상 파일 제거

삭제 대상:

```text
scripts/local_ai_health_check.py
scripts/verify_local_ai.py
scripts/__pycache__/
```

작업 전 확인:

```bash
git ls-files scripts/local_ai_health_check.py scripts/verify_local_ai.py scripts/__pycache__
```

삭제 후 확인:

```bash
find scripts -maxdepth 2 -type f -print
```

기대 결과:

```text
scripts/local_ai_common.py
scripts/start_local_ai_provider.py
```

### 3. `.gitignore` 확인 및 보강

확인:

```bash
rg -n "__pycache__|\\.pyc|\\.pyo" .gitignore
```

없으면 추가:

```gitignore
__pycache__/
*.py[cod]
```

### 4. `architecture/local_ai_models.md` 수정

수정할 핵심 내용:

- "루트 scripts 유지 대상" 섹션 추가.
- 유지 대상 표 추가.
- 삭제된 스크립트 명령 제거.
- 시작 명령은 다음만 유지합니다.

```bash
python3 scripts/start_local_ai_provider.py ocr
python3 scripts/start_local_ai_provider.py embedding
python3 scripts/start_local_ai_provider.py generation
```

- 명령 확인은 다음만 유지합니다.

```bash
python3 scripts/start_local_ai_provider.py generation --print-only
```

- `.env.local-ai` 제한을 명시합니다.

문서에 포함할 설명:

```md
`scripts/start_local_ai_provider.py`는 로컬 AI provider 실행을 위한 required 스크립트입니다.
`scripts/local_ai_common.py`는 이 실행 스크립트가 사용하는 공통 모듈이며 직접 실행하지 않습니다.
`scripts/`에는 required 실행 경로에 필요한 파일만 둡니다.
```

### 5. `apps/backend/README.md` 수정

수정 방향:

- `python3 scripts/local_ai_health_check.py` 명령 제거.
- 삭제된 검증 스크립트를 전제로 한 설명 제거.
- provider 시작 명령은 유지합니다.
- 필요하면 "전체 서비스 시작은 `./start_archive_services.sh` 사용" 문장을 유지하거나 보강합니다.

### 6. required 스크립트 코드 점검

삭제 후 남은 두 파일만 컴파일 검증합니다.

```bash
python3 -m py_compile scripts/local_ai_common.py scripts/start_local_ai_provider.py
```

`start_local_ai_provider.py --print-only`의 shell 출력은 공백 포함 경로에서 복사 실행이 깨질 수 있습니다. 이 TODO의 필수 범위는 삭제/문서화지만, 함께 고치면 좋은 작은 개선입니다.

수정 후보:

- `import shlex`
- `print(shlex.join(command))`

이 변경은 required 스크립트의 사용성을 높이고 삭제 작업과 충돌하지 않습니다.

### 7. 참조 정리 검증

삭제 대상 스크립트 이름이 문서나 코드에 남지 않아야 합니다.

```bash
rg -n "local_ai_health_check|verify_local_ai" README.md architecture apps scripts start_archive_services.sh stop_archive_services.sh
```

기대 결과:

- 삭제된 스크립트를 실행하라는 문서가 없어야 합니다.
- 과거 삭제 사유를 기록한 계획 문서 외에는 남지 않아야 합니다.

## 테스트 및 검증

### 파일 구조 검증

```bash
find scripts -maxdepth 2 -type f -print
```

기대 결과:

```text
scripts/local_ai_common.py
scripts/start_local_ai_provider.py
```

### 컴파일 검증

```bash
python3 -m py_compile scripts/local_ai_common.py scripts/start_local_ai_provider.py
```

### 명령 구성 검증

로컬 env가 준비된 상태에서:

```bash
python3 scripts/start_local_ai_provider.py ocr --print-only
python3 scripts/start_local_ai_provider.py embedding --print-only
python3 scripts/start_local_ai_provider.py generation --print-only
```

기대 결과:

- 각 role에 대한 `llama-server` 명령이 출력됩니다.
- 필수 env나 모델 파일이 없으면 어떤 env가 빠졌는지 명확히 실패합니다.

### 서비스 시작 경로 검증

```bash
./start_archive_services.sh
```

기대 결과:

- backend, frontend, local-ai-ocr, local-ai-embedding, local-ai-generation 시작 요청이 수행됩니다.
- local AI 시작은 계속 `scripts/start_local_ai_provider.py`를 통해 이루어집니다.

실제 모델 파일이 없는 개발 환경에서는 local AI 시작이 실패할 수 있습니다. 이 경우에도 실패 원인이 required env 또는 모델 파일 누락으로 드러나면 됩니다.

### 문서 참조 검증

```bash
rg -n "local_ai_health_check|verify_local_ai" README.md architecture apps
```

기대 결과:

- 결과 없음.

```bash
rg -n "start_local_ai_provider|local_ai_common" README.md architecture apps start_archive_services.sh
```

기대 결과:

- `start_local_ai_provider.py`는 실행 문서와 `start_archive_services.sh`에서 참조됩니다.
- `local_ai_common.py`는 architecture 문서에서 공통 모듈로 설명됩니다.

## 완료 기준

- `scripts/`에는 required 파일인 `local_ai_common.py`, `start_local_ai_provider.py`만 남아 있습니다.
- `local_ai_health_check.py`, `verify_local_ai.py`, `scripts/__pycache__/`가 제거되어 있습니다.
- 삭제된 스크립트를 실행하라는 문서가 남아 있지 않습니다.
- `architecture/local_ai_models.md`가 남은 required 스크립트의 역할과 사용법을 설명합니다.
- `.gitignore`가 Python 캐시 재유입을 막습니다.
- 남은 required 스크립트 2개가 `py_compile`을 통과합니다.

## 리스크 및 대응

- 진단 스크립트 삭제로 provider 상태 확인이 불편해질 수 있습니다.
  - 대응: 이 TODO의 목표는 required만 남기는 것이므로 진단 기능은 문서 명령, 로그 확인, backend 오류 메시지 확인으로 대체합니다. 별도 진단 도구가 다시 필요하면 새 TODO로 다룹니다.
- 문서에서 삭제된 명령이 남으면 사용자가 없는 파일을 실행하게 됩니다.
  - 대응: 삭제 후 `rg -n "local_ai_health_check|verify_local_ai"`로 전체 참조를 검증합니다.
- `local_ai_common.py`가 직접 실행 파일이 아니라서 삭제 대상으로 오해될 수 있습니다.
  - 대응: `start_local_ai_provider.py`의 required runtime dependency로 분류하고 architecture 문서에 명시합니다.
