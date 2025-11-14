import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import ThreadItem from './ThreadItem';
import ReplyBox from './ReplyBox';
import { Thread, Reply } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Search, Tag as TagIcon, X, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatTimestamp } from './ThreadItem';

const DiscussionThread: React.FC = () => {
  const { user } = useAuth();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostMessage, setNewPostMessage] = useState('');
  const [newPostTags, setNewPostTags] = useState<string[]>([]);
  const [newPostImagePreview, setNewPostImagePreview] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [availableTags, setAvailableTags] = useState<string[]>(['TestTag1', 'TestTag2']);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newCustomTag, setNewCustomTag] = useState('');
  
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);

  const handleCreatePost = async () => {
    if (!newPostTitle || !newPostMessage || !user) return;

    const formData = new FormData();
    formData.append("user_id", user.user_id!);
    formData.append("title", newPostTitle);
    formData.append("content", newPostMessage);
    formData.append("tags", newPostTags.join(","));
    if (newPostImagePreview && newPostImageFile) {
      formData.append("image", newPostImageFile);
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/forum/create", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.status === "success") {
        if (result.thread) {
          setThreads((prev) => [result.thread, ...prev]);
        }
      }
    } catch (err) {
      console.error("Error creating thread:", err);
    }

    setNewPostTitle("");
    setNewPostMessage("");
    setNewPostTags([]);
    setNewPostImagePreview(null);
    setIsCreatingPost(false);
    setIsAddingTag(false);
    setNewCustomTag('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewPostImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setNewPostImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
  const fetchThreads = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/forum");
      const data = await res.json();
      setThreads(data);
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    }
  };

  fetchThreads();
}, []);

  const handleRemoveImage = () => {
    setNewPostImagePreview(null);
  };

  const handleTagToggle = (tag: string) => {
    setNewPostTags((prevTags) =>
      prevTags.includes(tag)
        ? prevTags.filter((t) => t !== tag)
        : [...prevTags, tag]
    );
  };
  
  const handleAddNewTag = (tagValue: string) => {
    const trimmedTag = tagValue.trim();
    if (trimmedTag && trimmedTag.length <= 10) {
      if (!availableTags.includes(trimmedTag)) {
        setAvailableTags((prev) => [...prev, trimmedTag]);
      }
      if (!newPostTags.includes(trimmedTag)) {
        setNewPostTags((prev) => [...prev, trimmedTag]);
      }
      setNewCustomTag('');
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAddNewTag(newCustomTag);
    }
  };

  const handleTagInputBlur = () => {
    setIsAddingTag(false);
    setNewCustomTag('');
  };

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      const tags = thread.tags || [];
      const title = thread.title || '';
      const content = thread.content || '';
      const authorName = thread.author?.name || '';
      
      const tagMatch =
        selectedTag === 'all' || (tags as string[]).includes(selectedTag);

      const searchMatch =
        searchTerm.trim() === '' ||
        title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        authorName.toLowerCase().includes(searchTerm.toLowerCase());

      return tagMatch && searchMatch;
    });
  }, [threads, searchTerm, selectedTag]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) return null;
    return threads.find((t) => t.id === selectedThreadId);
  }, [threads, selectedThreadId]);

  const handlePostReply = async (replyContent: string) => {
    if (!selectedThreadId || !user) return;

    const formData = new FormData();
    formData.append("thread_id", selectedThreadId);
    formData.append("user_id", user.user_id!);
    formData.append("content", replyContent);

    try {
      const res = await fetch("http://127.0.0.1:8000/forum/reply", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (result.status === "success") {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThreadId
              ? { ...t, replies: [...(t.replies || []), result.reply] }
              : t
          )
        );
      }
    } catch (err) {
      console.error("Error posting reply:", err);
    }
  };

  
  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  };

  return (
    <div className="flex flex-row gap-6 p-4 md:p-6 h-[85vh]">
      <div 
        className={`${
          selectedThread ? 'w-1/2' : 'w-full'
        } flex flex-col gap-6 transition-all duration-300 h-full`}
      >
        <div className="flex flex-col gap-4">
          <div className="w-full">
            {!isCreatingPost ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search posts..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button onClick={() => setIsCreatingPost(true)}>
                  <Plus className="mr-2 h-4 w-4" /> New Post
                </Button>
              </div>
            ) : (
              <div className="p-4 border rounded-lg shadow-sm">
                <div className="flex flex-col gap-4">
                  
                  <div className="flex flex-row justify-between items-start gap-6">
                    <div className="flex-1">
                      <Label htmlFor="title" className="mb-2 block font-medium">
                        Title
                      </Label>
                      <Input
                        id="title"
                        value={newPostTitle}
                        onChange={(e) => setNewPostTitle(e.target.value)}
                        placeholder="Your post title..."
                      />
                    </div>

                    <div className="flex-shrink-0">
                      <Label htmlFor="image-upload" className="mb-2 block font-medium">
                        Attach Image
                      </Label>
                      {newPostImagePreview ? (
                        <div className="relative group h-20 w-20">
                          <img 
                            src={newPostImagePreview} 
                            alt="Preview" 
                            className="h-20 w-20 object-cover rounded-md border"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={handleRemoveImage}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <label
                          htmlFor="image-upload"
                          className="flex flex-col items-center justify-center h-20 w-20 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted"
                        >
                          <div className="flex flex-col items-center justify-center p-1 text-center">
                            <ImageIcon className="w-5 h-5 mb-1 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              Upload
                            </p>
                            <p className="text-[10px] text-muted-foreground">PNG, JPG</p>
                          </div>
                          <Input 
                            id="image-upload" 
                            type="file" 
                            className="hidden" 
                            accept="image/png, image/jpeg, image/gif"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="message" className="mb-2 block font-medium">
                      Message
                    </Label>
                    <Textarea
                      id="message"
                      value={newPostMessage}
                      onChange={(e) => setNewPostMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={8}
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block font-medium">
                      Tags
                    </Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <TagIcon className="h-4 w-4 text-muted-foreground" />
                      
                      {availableTags.map((tag) => (
                        <Button
                          key={tag}
                          variant={newPostTags.includes(tag) ? 'default' : 'outline'}
                          onClick={() => handleTagToggle(tag)}
                          size="sm"
                          className={`rounded-full ${
                            newPostTags.includes(tag) && tag === 'TestTag2'
                              ? 'bg-blue-600 hover:bg-blue-700 text-white border border-transparent'
                              : newPostTags.includes(tag)
                              ? 'border border-transparent'
                              : ''
                          }`}
                        >
                          {tag}
                        </Button>
                      ))}
                      
                      {!isAddingTag ? (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full h-9 w-9"
                          onClick={() => setIsAddingTag(true)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Input
                          type="text"
                          placeholder="Tag..."
                          className="h-9 text-sm w-24"
                          value={newCustomTag}
                          onChange={(e) => setNewCustomTag(e.target.value)}
                          onKeyDown={handleTagInputKeyDown}
                          onBlur={handleTagInputBlur}
                          autoFocus
                          maxLength={9}
                        />
                      )}
                    </div>
                  </div>

                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => {
                    setIsCreatingPost(false);
                    setNewPostImagePreview(null);
                    setIsAddingTag(false);
                    setNewCustomTag('');
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePost} disabled={!newPostTitle || !newPostMessage}>
                    Submit Post
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedTag === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedTag('all')}
            size="sm"
            className="rounded-full"
          >
            All Posts
          </Button>
          {availableTags.map((tag) => (
            <Button
              key={tag}
              variant={selectedTag === tag ? 'default' : 'outline'}
              onClick={() => setSelectedTag(tag)}
              size="sm"
              className="rounded-full"
            >
              {tag}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto flex-1">
          {filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => (
              <ThreadItem 
                key={thread.id || Math.random()}
                thread={thread}
                onSelectThread={setSelectedThreadId}
                isSelected={thread.id === selectedThreadId} 
              />
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No posts found.
            </div>
          )}
        </div>
      </div>

      {selectedThread && (
        <div className="w-1/2 border rounded-lg bg-blue-50 dark:bg-card flex flex-col h-full overflow-hidden">
          <div className="p-6 pb-4">
            <div className="flex justify-between items-start">
              <h2 className="text-4xl font-bold">{selectedThread.title}</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedThreadId(null)}
                className="text-muted-foreground -mt-2 -mr-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex gap-2 mt-2 pb-4 border-b">
              {(selectedThread.tags || []).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6">
            <div className="py-6 space-y-4">
              <div key={selectedThread.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={selectedThread.author?.avatarUrl} alt={selectedThread.author?.name} />
                  <AvatarFallback>
                    {getInitials(selectedThread.author?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-base">{selectedThread.author?.name || '...'}</span>
                    <Badge variant="outline" className="h-5 px-2 py-0.5 text-xs">OP</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(selectedThread.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedThread.content}</p>
                  {selectedThread.imageUrl && (
                    <img 
                      src={selectedThread.imageUrl} 
                      alt="Post attachment"
                      className="mt-4 w-16/h max-w-lg rounded-lg border"
                    />
                  )}
                </div>
              </div>

              {(selectedThread.replies || []).map((reply) => (
                <div key={reply.id} className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={reply.author?.avatarUrl} alt={reply.author?.name} />
                    <AvatarFallback>
                      {getInitials(reply.author?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-base">{reply.author?.name || '...'}</span>
                      {reply.author?.name === selectedThread.author?.name && (
                        <Badge variant="outline" className="h-5 px-2 py-0.5 text-xs">OP</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(reply.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
          
          <ReplyBox onSubmit={handlePostReply} />
        </div>
      )}
    </div>
  );
};

export default DiscussionThread;