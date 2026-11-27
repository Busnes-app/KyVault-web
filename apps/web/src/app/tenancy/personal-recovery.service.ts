import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  PersonalRecoveryPayload,
  RecoveryContext,
  createPersonalRecovery,
  openPersonalRecovery,
} from "./personal-recovery-crypto";
import { TenancyService } from "./tenancy.service";

@Injectable({ providedIn: "root" })
export class PersonalRecoveryService {
  private readonly api = inject(ApiService);
  private readonly keys = inject(KeyService);
  private readonly tenancy = inject(TenancyService);

  async prepare(context: RecoveryContext & { userId: UserId }) {
    const userKey = await firstValueFrom(this.keys.userKey$(context.userId));
    if (!userKey) {
      throw new Error("Unlock your vault before creating a recovery kit");
    }
    const privateKey = await firstValueFrom(this.keys.userPrivateKey$(context.userId));
    // toEncoded may return the live key for legacy keys: never wipe that buffer.
    // Decode the existing serialization directly into an owned temporary copy.
    const copy = Uint8Array.from(atob(userKey.keyB64), (char) => char.charCodeAt(0));
    return createPersonalRecovery(
      copy,
      context,
      privateKey ? new Uint8Array(privateKey) : undefined,
    );
  }

  async save(payload: PersonalRecoveryPayload, userId: UserId): Promise<void> {
    await this.api.send("PUT", "/tenancy/recovery/personal", payload, userId, true);
    this.tenancy.refresh();
  }

  async verify(secret: string, context: RecoveryContext & { userId: UserId }): Promise<boolean> {
    const bundle: unknown = await this.api.send(
      "GET",
      "/tenancy/recovery/personal",
      null,
      context.userId,
      true,
    );
    const opened = await openPersonalRecovery(bundle, secret, context);
    try {
      const current = await firstValueFrom(this.keys.userKey$(context.userId));
      if (!current) {
        throw new Error("Unlock your vault to test the current recovery kit");
      }
      // Compare with the current vault key too: a kit can become stale after user-key rotation.
      const expected = Uint8Array.from(atob(current.keyB64), (char) => char.charCodeAt(0));
      try {
        return (
          expected.length === opened.userKey.length &&
          expected.every((byte, index) => byte === opened.userKey[index])
        );
      } finally {
        expected.fill(0);
      }
    } finally {
      opened.userKey.fill(0);
      opened.privateKey?.fill(0);
    }
  }

  async revoke(userId: UserId): Promise<void> {
    await this.api.send("DELETE", "/tenancy/recovery/personal", null, userId, false);
    this.tenancy.refresh();
  }
}
