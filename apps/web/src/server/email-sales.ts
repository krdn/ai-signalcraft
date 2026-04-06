import { Resend } from 'resend';

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'AI SignalCraft <noreply@yourdomain.com>';
const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

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

// 데모 초대 이메일
export async function sendDemoInviteEmail(params: {
  to: string;
  contactName: string;
  companyName: string;
}) {
  const demoUrl = `${BASE_URL}/demo`;

  const result = await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: '[AI SignalCraft] AI 여론 분석 서비스 무료 체험 초대',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">무료 체험 초대</h2>
        <p>${params.contactName}님 안녕하세요,</p>
        <p>AI SignalCraft의 AI 여론 분석 서비스를 무료로 체험해 보시기 바랍니다.</p>
        <ul style="line-height: 1.8; color: #444;">
          <li>AI 분석 3회 무료 제공</li>
          <li>7일간 핵심 모듈 이용 가능</li>
          <li>별도 결제 정보 없이 바로 시작</li>
        </ul>
        <div style="margin: 24px 0; text-align: center;">
          <a href="${demoUrl}"
             style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            무료 체험 시작하기
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">궁금하신 점이 있으시면 편하게 회신해 주세요.</p>
      </div>
    `,
  });

  return result;
}

// 영업 이메일 (템플릿 기반)
export async function sendSalesEmail(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ messageId?: string }> {
  const result = await getResend().emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        ${params.body}
      </div>
    `,
  });

  return { messageId: result.data?.id };
}
