/**
 * Signs short-lived JWTs so the dashboard can call agent backends
 * (e.g. Craig's /admin/api/*) with a verifiable identity claim.
 *
 * Secret is STRATEGOS_JWT_SECRET and is shared with each agent backend.
 */
import { SignJWT } from 'jose';

const ISSUER = 'strategos-dashboard';

interface AgentTokenClaims {
    email: string;
    org_slug: string;
    role: string;
}

function getSecret(): Uint8Array {
    const secret = process.env.STRATEGOS_JWT_SECRET;
    if (!secret) throw new Error('STRATEGOS_JWT_SECRET is not set');
    return new TextEncoder().encode(secret);
}

/**
 * Mint a 5-minute JWT for an agent backend call.
 * The agent verifies the signature + claims and filters data by org_slug.
 */
export async function signAgentToken(claims: AgentTokenClaims): Promise<string> {
    return new SignJWT({ ...claims })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .setIssuer(ISSUER)
        .setSubject(claims.email)
        .sign(getSecret());
}
