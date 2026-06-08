import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DocumentExtractorClient from '@/components/document-extractor/DocumentExtractorClient';

export const metadata = { title: 'Doc Reader — QC Estimator' };

export default async function DocumentExtractorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-serif font-medium text-brand-charcoal">Doc Reader</h1>
        <p className="text-sm text-brand-slate mt-1">
          Extract text and images from vendor PDFs and Word documents.
        </p>
      </div>
      <DocumentExtractorClient />
    </div>
  );
}
