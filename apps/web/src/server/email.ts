import { Resend } from 'resend';

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'AI SignalCraft <noreply@yourdomain.com>';

// Lazy 초기화: 빌드 시 API 키 없어도 에러 방지
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY 환경 변수가 설정되지 않았습니다');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendVerificationEmail(params: { to: string; verificationUrl: string }) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: '[AI SignalCraft] 이메일 인증',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">이메일 인증</h2>
        <p>아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.</p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="${params.verificationUrl}"
             style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            이메일 인증하기
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">버튼이 작동하지 않으면 아래 링크를 브라우저에 복사해 주세요.</p>
        <p style="color: #999; font-size: 12px; word-break: break-all;">${params.verificationUrl}</p>
        <p style="color: #666; font-size: 13px; margin-top: 16px;">이 링크는 10분 후 만료됩니다.</p>
        <p style="color: #666; font-size: 13px;">본인이 요청하지 않은 경우 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });
}

export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  teamName: string;
  inviteUrl: string;
  role: 'admin' | 'member';
}) {
  const roleLabel = params.role === 'admin' ? '관리자' : '멤버';

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: '[AI SignalCraft] 팀 초대',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">팀 초대</h2>
        <p>${params.inviterName}님이 <strong>${params.teamName}</strong> 팀에 초대했습니다.</p>
        <p>역할: <strong>${roleLabel}</strong></p>
        <a href="${params.inviteUrl}"
           style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          초대 수락하기
        </a>
        <p style="color: #666; font-size: 13px;">이 링크는 7일 후 만료됩니다.</p>
      </div>
    `,
  });
}
