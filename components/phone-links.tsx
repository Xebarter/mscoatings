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
        // When stacked, ensure phone numbers render on separate lines.
        // (Default inline anchors + `space-y` can still appear "too close".)
        layout === 'stack'
          ? 'flex flex-col gap-y-2'
          : 'flex flex-wrap gap-x-4 gap-y-2',
        className
      )}
    >
      {BUSINESS_PHONES.map((phone) => (
        <a
          key={phone.tel}
          href={getTelHref(phone.tel)}
          className={cn('block', linkClassName)}
        >
          {phone.display}
        </a>
      ))}
    </div>
  );
}
