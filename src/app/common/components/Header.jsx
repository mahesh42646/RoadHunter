"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Container, Nav, Navbar } from "react-bootstrap";

import useAuthStore, { selectIsAuthenticated } from "@/store/useAuthStore";
import useAuthActions from "@/app/user/hooks/useAuthActions";

export default function Header() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const { logout } = useAuthActions();

  if (!hydrated) {
    return (
      <Navbar expand="lg" bg="transparent" variant="dark" className="py-3 position-fixed w-100 z-3">
        <Container>
          <Link className="navbar-brand fw-bold fs-3 rainbow-text" href="/">
            Road Hunter
          </Link>
        </Container>
      </Navbar>
    );
  }

  return (
    <Navbar expand="lg" bg="transparent" variant="dark" className="py-3 position-fixed w-100 z-3">
      <Container>
        <Link className="navbar-brand fw-bold fs-3 rainbow-text" href="/">
        Road Hunter
        </Link>
        <Navbar.Toggle aria-controls="primary-nav" />
        <Navbar.Collapse id="primary-nav">
          <Nav className="me-auto">
            <Link className={`nav-link ${pathname === "/" ? "active" : ""}`} href="/">
              Home
            </Link>
            <Link className={`nav-link ${pathname.startsWith("/#") ? "active" : ""}`} href="/aboutus">
            About Us
            </Link>
            <Link className={`nav-link ${pathname.startsWith("/#") ? "active" : ""}`} href="/howitworks">
            How It Works            </Link>
            <Link className={`nav-link ${pathname.startsWith("/#") ? "active" : ""}`} href="/contactus">
            Contact Us
            </Link>
            <Link className={`nav-link ${pathname.startsWith("/#") ? "active" : ""}`} href="/faq">
            FAQ
            </Link>
           
           
          </Nav>
          <div className="d-flex gap-3 align-items-center">
            {isAuthenticated ? (
              <>
                <span className="small" style={{ color: "var(--text-muted)" }}>
                  {user?.account?.displayName ?? user?.account?.email}
                </span>
                <Button variant="outline-light" size="sm" onClick={logout}>
                  Logout
                </Button>
                <Button as={Link} href="/dashboard" variant="primary" size="sm">
                  Dashboard
                </Button>
              </>
            ) : (
              <>
                <Button as={Link} href="/user/login" variant="outline-light" size="sm">
                  Login
                </Button>
                <Button as={Link} href="/user/signup" variant="primary" size="sm">
                  Sign up
                </Button>
              </>
            )}
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

