import { getAllShareLinks } from '@/lib/supabase/queries';
import ShareLinksDashboard from '@/components/budget/ShareLinksDashboard';

export const dynamic = 'force-dynamic';

export default async function ShareLinksPage() {
  const links = await getAllShareLinks();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div>
        <h1 className="font-serif text-2xl font-medium text-brand-charcoal">Client share links</h1>
        <p className="text-sm text-brand-silver mt-1">
          Every budget link shared with a client, across all programs. Revoke any link — or all active links — to immediately shut off access.
        </p>
      </div>
      <ShareLinksDashboard links={links} />
    </div>
  );
}
