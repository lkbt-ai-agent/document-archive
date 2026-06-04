# 로컬 AI 모델

로컬 AI는 llama.cpp `llama-server`를 사용합니다. 백엔드는 OCR, embedding, generation 역할을 별도 제공자로 봅니다.

## 역할과 기본 포트

| 역할 | 기본 포트 | 기본 모델 | 용도 |
| --- | --- | --- | --- |
| `ocr` | `8081` | `Qwen2.5-VL-7B-Instruct` | 이미지 OCR |
| `embedding` | `8082` | `BGE-M3` | 청크/검색어 임베딩 |
| `generation` | `8083` | `Qwen3-14B` | 메타데이터, 요약, 생성 |

## 환경변수

`.env.local-ai`가 있으면 백엔드와 스크립트가 자동으로 읽습니다.

```bash
LLAMA_CPP_SERVER_BIN=/absolute/path/to/llama-server
LLAMA_CPP_OCR_BASE_URL=http://127.0.0.1:8081
LLAMA_CPP_EMBEDDING_BASE_URL=http://127.0.0.1:8082
LLAMA_CPP_GENERATION_BASE_URL=http://127.0.0.1:8083
LOCAL_AI_OCR_MODEL_PATH=/absolute/path/to/ocr.gguf
LOCAL_AI_OCR_MMPROJ_PATH=/absolute/path/to/mmproj.gguf
LOCAL_AI_EMBEDDING_MODEL_PATH=/absolute/path/to/embedding.gguf
LOCAL_AI_GENERATION_MODEL_PATH=/absolute/path/to/generation.gguf
```

generation 서버의 기본 컨텍스트는 `8192`입니다. 더 크게 실행하려면 다음처럼 환경변수로 지정합니다.

```bash
LOCAL_AI_GENERATION_CTX_SIZE=8192
```

이 값은 generation 서버를 다시 시작해야 적용됩니다.

임베딩 서버가 배치 크기 오류를 내면 다음 값을 조정합니다.

```bash
LOCAL_AI_EMBEDDING_REQUEST_BATCH_SIZE=1
LOCAL_AI_EMBEDDING_BATCH_SIZE=512
LOCAL_AI_EMBEDDING_UBATCH_SIZE=512
LOCAL_AI_EMBEDDING_DIMENSION=1024
```

## 시작

```bash
python3 scripts/start_local_ai_provider.py ocr
python3 scripts/start_local_ai_provider.py embedding
python3 scripts/start_local_ai_provider.py generation
```

실행 명령만 보려면:

```bash
python3 scripts/start_local_ai_provider.py generation --print-only
```

## 점검

```bash
python3 scripts/local_ai_health_check.py
python3 scripts/verify_local_ai.py --image /absolute/path/to/sample-image.png
```

`verify_local_ai.py`는 OCR, embedding, generation 서버에 실제 요청을 보냅니다.

## 운영 메모

Mac Mini 24GB에서는 필요한 제공자만 켭니다. Qwen2.5-VL과 Qwen3-14B를 동시에 오래 실행하면 메모리 압박이 생길 수 있습니다.
