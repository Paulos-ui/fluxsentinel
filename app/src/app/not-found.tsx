import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <div className="mono text-6xl text-dim mb-4">404</div>
      <div className="mono text-sm text-text mb-6">Page not found</div>
      <Link href="/dashboard" className="btn-primary text-xs px-6 py-2">
        BACK TO DASHBOARD
      </Link>
    </div>
  );
}
