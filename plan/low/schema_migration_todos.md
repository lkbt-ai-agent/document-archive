# 스키마 마이그레이션 TODO

## 범위

운영 데이터 변경을 추적 가능한 마이그레이션으로 관리합니다.

## 백엔드

- 현재 시작 시 `create_all()`과 일부 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 보정만 수행합니다.
- Alembic 같은 마이그레이션 도구가 필요합니다.
- pgvector 확장, 인덱스, 컬럼 추가/변경 이력을 명시적으로 관리해야 합니다.
