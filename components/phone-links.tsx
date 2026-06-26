import { BUSINESS_PHONES, getTelHref } from '@/lib/seo/business';
import { cn } from '@/lib/utils';

interface PhoneLinksProps {
  className?: string;
  linkClassName?: string;
  layout?: 'stack' | 'inline';
}

export default function PhoneLinks({
  className,
  linkClassName = 'transition-colors hover:text-cyan',
  layout = 'stack',
}: PhoneLinksProps) {
  return (
    <div
      className={cn(
        layout === 'stack' ? 'space-y-1' : 'flex flex-wrap gap-x-3 gap-y-1',
        className
      )}
    >
      {BUSINESS_PHONES.map((phone) => (
        <a key={phone.tel} href={getTelHref(phone.tel)} className={linkClassName}>
          {phone.display}
        </a>
      ))}
    </div>
  );
}
