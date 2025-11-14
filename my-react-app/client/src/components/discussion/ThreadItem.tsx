import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock } from 'lucide-react';
import { Thread } from './types';

interface ThreadItemProps {
  thread: Thread;
  onSelectThread: (id: string) => void;
  isSelected: boolean;
}

export const formatTimestamp = (isoString: string) => {
  if (!isoString) return '...'; 
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return '...';
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getInitials = (name: string) => {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('');
};

const ThreadItem: React.FC<ThreadItemProps> = ({ thread, onSelectThread, isSelected }) => {
  const content = thread.content || '';
  const truncatedContent =
    content.length > 100
      ? `${content.substring(0, 100)}...`
      : content;

  return (
    <Card 
      className={`w-full transition-all hover:shadow-md cursor-pointer ${
        isSelected ? 'border-primary shadow-md' : ''
      }`}
      onClick={() => thread.id && onSelectThread(thread.id)}
    >
      <div className="flex flex-row items-start">
        <div className="flex-1 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex gap-2 mb-2">
              {(thread.tags || []).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <CardTitle className="text-xl">{thread.title || 'Untitled Post'}</CardTitle>
          </CardHeader>
          
          <CardContent className="py-2">
            <CardDescription>
              <span className="font-semibold text-primary">{thread.author?.name || 'Anonymous User'}</span>
              : {truncatedContent}
            </CardDescription>
          </CardContent>
        </div>

        {thread.imageUrl && (
          <div className="p-6 pl-0">
            <img 
              src={thread.imageUrl} 
              alt="Thread attachment" 
              className="rounded-md border object-cover h-20 w-20" 
            />
          </div>
        )}
      </div>

      <CardFooter className="pt-2 pb-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center space-x-1">
          <MessageSquare size={14} />
          <span>{(thread.replies || []).length + 1} replies</span>
        </div>
        <div className="flex items-center space-x-1">
          <Clock size={14} />
          <span>{formatTimestamp(thread.timestamp)}</span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ThreadItem;