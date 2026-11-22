export type PlatformRole = 'admin' | 'staff' | 'doctor' | 'user';
export interface AuthClaims {
    sub: string;
    name?: string;
    platformRole?: PlatformRole;
    iat?: number;
    exp?: number;
}
export interface AckOk<T = Record<string, never>> {
    ok: true;
    data: T;
}
export interface AckError {
    ok: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
export type Ack<T = Record<string, never>> = AckOk<T> | AckError;
export declare const ok: <T>(data: T) => AckOk<T>;
export declare const fail: (code: string, message: string, details?: unknown) => AckError;
