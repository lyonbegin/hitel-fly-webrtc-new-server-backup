import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class SessionJoinDto {
  @IsString() sessionId: string;
}

export class SessionReadyDto {
  @IsString() sessionId: string;
  @IsBoolean() ready: boolean;
}

export class SessionIdDto {
  @IsString() sessionId: string;
}

export class RtcJoinDto {
  @IsString() sessionId: string;
  @IsOptional() @IsBoolean() resume?: boolean;
}

export class CreateTransportDto {
  @IsString() sessionId: string;
  @IsString() direction: 'send' | 'recv';
}

export class ConnectTransportDto {
  @IsString() sessionId: string;
  @IsString() transportId: string;
  @IsObject() dtlsParameters: any;
}

export class ProduceDto {
  @IsString() sessionId: string;
  @IsString() transportId: string;
  @IsString() kind: 'audio' | 'video';
  @IsObject() rtpParameters: any;
  @IsOptional() @IsObject() appData?: Record<string, unknown>;
}

export class ConsumeDto {
  @IsString() sessionId: string;
  @IsString() transportId: string;
  @IsString() producerId: string;
  @IsObject() rtpCapabilities: any;
}

export class ConsumerIdDto {
  @IsString() sessionId: string;
  @IsString() consumerId: string;
}

export class TransportIdDto {
  @IsString() sessionId: string;
  @IsString() transportId: string;
}

export class ProducerIdDto {
  @IsString() sessionId: string;
  @IsString() producerId: string;
}

export class PreferredLayersDto extends ConsumerIdDto {
  @IsInt() @Min(0) spatialLayer: number;
  @IsOptional() @IsInt() @Min(0) temporalLayer?: number;
}
