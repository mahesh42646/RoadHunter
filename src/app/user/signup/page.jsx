import AuthPanel from "../components/AuthPanel";

export const metadata = {
  title: "Create Account | PartyVerse",
};

export default function SignupPage() {
  return <AuthPanel initialTab="register" />;
}

