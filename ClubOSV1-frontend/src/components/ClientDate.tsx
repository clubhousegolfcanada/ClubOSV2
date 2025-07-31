import { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';

interface ClientDateProps {
  date: string | Date;
  format?: 'relative' | 'time';
  fallback?: string;
  className?: string;
}

export function ClientDate({ date, format: dateFormat = 'relative', fallback = '', className }: ClientDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={className}>{fallback}</span>;
  }

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return <span className={className}>{fallback}</span>;
    }

    if (dateFormat === 'relative') {
      return <span className={className}>{formatDistanceToNow(dateObj, { addSuffix: true })}</span>;
    } else if (dateFormat === 'time') {
      return <span className={className}>{format(dateObj, 'h:mm a')}</span>;
    }

    return <span className={className}>{fallback}</span>;
  } catch (error) {
    return <span className={className}>{fallback}</span>;
  }
}