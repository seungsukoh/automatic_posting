# Local MVP App

의존성 없는 Python 표준 라이브러리 기반 로컬 MVP입니다.

## 실행

```powershell
python app/server.py
```

브라우저에서 `http://127.0.0.1:8000`을 엽니다.

다른 DB 파일로 실행하려면 `AUTOMATICPOSTING_DB`를 지정합니다.

```powershell
$env:AUTOMATICPOSTING_DB="data/dev.db"
python app/server.py
```

## 현재 기능

- 게시글 작성
- 플랫폼 선택
- Mock 발행 작업 생성
- 즉시 발행
- 예약 발행 작업 저장
- 예약 작업 수동 실행
- 실패 작업 재시도
- SQLite 저장

## 현재 제한

- 실제 Instagram/Threads/Kakao API는 아직 호출하지 않습니다.
- 파일 업로드는 실제 바이너리 저장 없이 파일명만 기록합니다.
- 로그인은 다음 단계에서 추가합니다.
