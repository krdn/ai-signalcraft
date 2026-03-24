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
