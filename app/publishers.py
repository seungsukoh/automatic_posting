from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class PublishPayload:
    title: str
    body: str
    link_url: str
    hashtags: str
    image_name: str
    platform_body: str


@dataclass(frozen=True)
class PublishResult:
    status: str
    error_message: str
    external_post_url: str

    def to_dict(self) -> dict[str, str]:
        return {
            "status": self.status,
            "error_message": self.error_message,
            "external_post_url": self.external_post_url,
        }


class Publisher(Protocol):
    platform: str

    def publish(self, payload: PublishPayload) -> PublishResult:
        ...


class InstagramPublisher:
    platform = "instagram"

    def publish(self, payload: PublishPayload) -> PublishResult:
        return PublishResult(
            status="success",
            error_message="",
            external_post_url="https://example.local/instagram/mock-post",
        )


class ThreadsPublisher:
    platform = "threads"

    def publish(self, payload: PublishPayload) -> PublishResult:
        return PublishResult(
            status="success",
            error_message="",
            external_post_url="https://example.local/threads/mock-post",
        )


class KakaoPublisher:
    platform = "kakao"

    def publish(self, payload: PublishPayload) -> PublishResult:
        return PublishResult(
            status="failed",
            error_message="Kakao 공식 발송 방식이 아직 설정되지 않았습니다.",
            external_post_url="",
        )


PUBLISHERS: dict[str, Publisher] = {
    "instagram": InstagramPublisher(),
    "threads": ThreadsPublisher(),
    "kakao": KakaoPublisher(),
}


def publish_to_platform(platform: str, payload: PublishPayload) -> dict[str, str]:
    publisher = PUBLISHERS.get(platform.lower())
    if not publisher:
        return PublishResult(
            status="failed",
            error_message=f"Unsupported platform: {platform}",
            external_post_url="",
        ).to_dict()
    return publisher.publish(payload).to_dict()
