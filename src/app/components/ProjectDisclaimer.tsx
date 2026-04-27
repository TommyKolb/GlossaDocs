export function ProjectDisclaimer({ className }: { className?: string }) {
  const mailHref =
    'mailto:glossadocs@gmail.com?subject=' + encodeURIComponent('GlossaDocs feedback');

  return (
    <p className={className}>
      GlossaDocs is a small hobby project. Language defaults, typography, and keyboard helpers may
      contain mistakes. If you notice something wrong, please email{' '}
      <a href={mailHref} className="text-blue-600 underline underline-offset-2 hover:text-blue-800">
        glossadocs@gmail.com
      </a>{' '}
      with a short description of the issue and, if you can, a link or screenshot so it can be
      fixed.
    </p>
  );
}
