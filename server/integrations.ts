import { DomainError } from "./domain.ts";
export interface DeliveryRequest {
  idempotencyKey: string;
  channel: "email" | "sms" | "accounting" | "payment";
  documentId: string;
}
export interface DeliveryResult {
  status: "test-accepted";
  externalId: string;
  realDelivery: false;
}
export interface IntegrationAdapter {
  accept(request: DeliveryRequest): DeliveryResult;
}
export class TestAdapter implements IntegrationAdapter {
  accept(request: DeliveryRequest): DeliveryResult {
    return {
      status: "test-accepted",
      externalId: "test-" + request.channel + "-" + request.idempotencyKey,
      realDelivery: false,
    };
  }
}
export class UnconfiguredAdapter implements IntegrationAdapter {
  accept(_request: DeliveryRequest): never {
    throw new DomainError(
      503,
      "Внешний провайдер не настроен: отправка не выполнена",
    );
  }
}
