import type { Platform, PublishPayload, PublishResult } from "./types";

export interface Publisher {
  publish(payload: PublishPayload): Promise<PublishResult>;
}

class InstagramPublisher implements Publisher {
  async publish(_payload: PublishPayload): Promise<PublishResult> {
    return {
      status: "success",
      error_message: "",
      external_post_url: "https://example.local/instagram/mock-post",
    };
  }
}

class ThreadsPublisher implements Publisher {
  async publish(_payload: PublishPayload): Promise<PublishResult> {
    return {
      status: "success",
      error_message: "",
      external_post_url: "https://example.local/threads/mock-post",
    };
  }
}

class KakaoPublisher implements Publisher {
  async publish(_payload: PublishPayload): Promise<PublishResult> {
    return {
      status: "failed",
      error_message: "Kakao official sending route is not configured.",
      external_post_url: "",
    };
  }
}

const publishers: Record<Platform, Publisher> = {
  instagram: new InstagramPublisher(),
  threads: new ThreadsPublisher(),
  kakao: new KakaoPublisher(),
};

export async function publishToPlatform(platform: string, payload: PublishPayload): Promise<PublishResult> {
  const publisher = publishers[platform.toLowerCase() as Platform];
  if (!publisher) {
    return {
      status: "failed",
      error_message: `Unsupported platform: ${platform}`,
      external_post_url: "",
    };
  }
  return publisher.publish(payload);
}
