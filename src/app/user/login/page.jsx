import AuthPanel from "../components/AuthPanel";

export const metadata = {
  title: "Login | PartyVerse",
};

export default function LoginPage() {
  return <AuthPanel initialTab="login" />;
}

