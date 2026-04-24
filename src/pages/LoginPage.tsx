import Placeholder from '../components/shared/Placeholder';

export default function LoginPage() {
  return (
    <Placeholder
      testId="login-page"
      eyebrow="Welcome · Tripline"
      title="使用 Cloudflare Access 登入"
      body="目前以 Cloudflare Access email 白名單保護 /manage。進入管理頁會觸發 Access 登入 flow。未來 V2 會換成 OAuth（Google / Apple / LINE）。"
      ctaLabel="前往 /manage 登入"
    />
  );
}
