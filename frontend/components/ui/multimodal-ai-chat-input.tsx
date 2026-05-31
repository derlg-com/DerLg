'use client';

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';

import equal from 'fast-deep-equal';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 as LoaderIcon, X as XIcon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Type Definitions
export interface Attachment {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

interface UIMessage {
  id: string;
  content: string;
  role: string;
  attachments?: Attachment[];
}

export interface SuggestedAction {
  title: string;
  label: string;
  action: string;
}

// Button variants using cva
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm text-foreground',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

const StopIcon = ({ size = 16 }: { size?: number }) => (
  <svg height={size} viewBox="0 0 16 16" width={size} style={{ color: 'currentcolor' }}>
    <path fillRule="evenodd" clipRule="evenodd" d="M3 3H13V13H3V3Z" fill="currentColor" />
  </svg>
);

const PaperclipIcon = ({ size = 16 }: { size?: number }) => (
  <svg height={size} strokeLinejoin="round" viewBox="0 0 16 16" width={size} style={{ color: 'currentcolor' }} className="-rotate-45">
    <path fillRule="evenodd" clipRule="evenodd" d="M10.8591 1.70735C10.3257 1.70735 9.81417 1.91925 9.437 2.29643L3.19455 8.53886C2.56246 9.17095 2.20735 10.0282 2.20735 10.9222C2.20735 11.8161 2.56246 12.6734 3.19455 13.3055C3.82665 13.9376 4.68395 14.2927 5.57786 14.2927C6.47178 14.2927 7.32908 13.9376 7.96117 13.3055L14.2036 7.06304L14.7038 6.56287L15.7041 7.56321L15.204 8.06337L8.96151 14.3058C8.06411 15.2032 6.84698 15.7074 5.57786 15.7074C4.30875 15.7074 3.09162 15.2032 2.19422 14.3058C1.29682 13.4084 0.792664 12.1913 0.792664 10.9222C0.792664 9.65305 1.29682 8.43592 2.19422 7.53852L8.43666 1.29609C9.07914 0.653606 9.95054 0.292664 10.8591 0.292664C11.7678 0.292664 12.6392 0.653606 13.2816 1.29609C13.9241 1.93857 14.2851 2.80997 14.2851 3.71857C14.2851 4.62718 13.9241 5.49858 13.2816 6.14106L7.0324 12.3835C6.64459 12.7712 6.11905 12.9888 5.57107 12.9888C5.02297 12.9888 4.49731 12.7711 4.10974 12.3835C3.72217 11.9959 3.50444 11.4703 3.50444 10.9222C3.50444 10.3741 3.72217 9.8484 4.10974 9.46084L9.877 3.70039L10.3775 3.20051L11.3772 4.20144L10.8767 4.70131L5.11008 10.4612C4.98779 10.5835 4.91913 10.7493 4.91913 10.9222C4.91913 11.0951 4.98782 11.2609 5.11008 11.3832C5.23234 11.5054 5.39817 11.5741 5.57107 11.5741C5.74398 11.5741 5.9098 11.5054 6.03206 11.3832L12.2813 5.14072C12.6586 4.7633 12.8704 4.25185 12.8704 3.71857C12.8704 3.18516 12.6585 2.6736 12.2813 2.29643C11.9041 1.91925 11.3926 1.70735 10.8591 1.70735Z" fill="currentColor" />
  </svg>
);

const ArrowUpIcon = ({ size = 16 }: { size?: number }) => (
  <svg height={size} strokeLinejoin="round" viewBox="0 0 16 16" width={size} style={{ color: 'currentcolor' }}>
    <path fillRule="evenodd" clipRule="evenodd" d="M8.70711 1.39644C8.31659 1.00592 7.68342 1.00592 7.2929 1.39644L2.21968 6.46966L1.68935 6.99999L2.75001 8.06065L3.28034 7.53032L7.25001 3.56065V14.25V15H8.75001V14.25V3.56065L12.7197 7.53032L13.25 8.06065L14.3107 6.99999L13.7803 6.46966L8.70711 1.39644Z" fill="currentColor" />
  </svg>
);

const DEFAULT_SUGGESTIONS: SuggestedAction[] = [
  { title: 'Show me trips', label: 'to Siem Reap for 5 days', action: 'Show me trips to Siem Reap for 5 days' },
  { title: 'Find hotels', label: 'near Angkor Wat', action: 'Find hotels near Angkor Wat' },
  { title: 'What is the weather', label: 'in Phnom Penh this week?', action: 'What is the weather in Phnom Penh this week?' },
  { title: 'Estimate a budget', label: 'for a 3-day food tour', action: 'Estimate a budget for a 3-day food tour in Cambodia' },
];

function PureSuggestedActions({
  onSelectAction,
  suggestions,
}: {
  onSelectAction: (action: string) => void;
  suggestions: SuggestedAction[];
}) {
  return (
    <div data-testid="suggested-actions" className="grid pb-2 sm:grid-cols-2 gap-2 w-full">
      <AnimatePresence>
        {suggestions.map((s, index) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.05 * index }}
            key={`suggested-action-${index}`}
            className={index > 1 ? 'hidden sm:block' : 'block'}
          >
            <Button
              variant="ghost"
              onClick={() => onSelectAction(s.action)}
              className="text-left border border-border rounded-xl px-4 py-3.5 text-sm flex-1 gap-1 sm:flex-col w-full h-auto justify-start items-start"
            >
              <span className="font-medium">{s.title}</span>
              <span className="text-muted-foreground">{s.label}</span>
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const SuggestedActions = memo(PureSuggestedActions, (p, n) => equal(p.suggestions, n.suggestions));

const PreviewAttachment = ({ attachment, isUploading = false }: { attachment: Attachment; isUploading?: boolean }) => {
  const { name, url, contentType } = attachment;
  return (
    <div data-testid="input-attachment-preview" className="flex flex-col gap-1">
      <div className="w-20 h-16 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center overflow-hidden border border-border">
        {contentType?.startsWith('image/') && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={name ?? 'attachment'} className="rounded-md size-full object-cover" />
        ) : (
          <div className="flex items-center justify-center text-xs text-muted-foreground text-center p-1">
            {name?.split('.').pop()?.toUpperCase() || 'FILE'}
          </div>
        )}
        {isUploading && (
          <div data-testid="input-attachment-loader" className="animate-spin absolute text-muted-foreground">
            <LoaderIcon className="size-5" />
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground max-w-20 truncate">{name}</div>
    </div>
  );
};

function PureSendButton({
  submitForm,
  isDisabled,
}: {
  submitForm: () => void;
  isDisabled: boolean;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit"
      onClick={(e) => {
        e.preventDefault();
        if (!isDisabled) submitForm();
      }}
      disabled={isDisabled}
      aria-label="Send message"
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}
const SendButton = memo(PureSendButton, (p, n) => p.isDisabled === n.isDisabled && p.submitForm === n.submitForm);

function PureStopButton({ onStop }: { onStop: () => void }) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit"
      onClick={(e) => {
        e.preventDefault();
        onStop();
      }}
      aria-label="Stop generating"
    >
      <StopIcon size={14} />
    </Button>
  );
}
const StopButton = memo(PureStopButton, (p, n) => p.onStop === n.onStop);

export interface MultimodalInputProps {
  messages: Array<UIMessage>;
  onSendMessage: (params: { input: string; attachments: Attachment[] }) => void;
  onStopGenerating: () => void;
  isGenerating: boolean;
  canSend: boolean;
  className?: string;
  placeholder?: string;
  suggestions?: SuggestedAction[];
  /** File attachments require an upload backend; off by default (text-only agent). */
  allowAttachments?: boolean;
  attachments?: Array<Attachment>;
  setAttachments?: Dispatch<SetStateAction<Array<Attachment>>>;
}

function PureMultimodalInput({
  messages,
  onSendMessage,
  onStopGenerating,
  isGenerating,
  canSend,
  className,
  placeholder = 'Send a message…',
  suggestions = DEFAULT_SUGGESTIONS,
  allowAttachments = false,
  attachments = [],
  setAttachments,
}: MultimodalInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const adjustHeight = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight + 2}px`;
    }
  };

  const resetHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.rows = 1;
      adjustHeight();
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) adjustHeight();
  }, [input]);

  const uploadFile = async (file: File): Promise<Attachment | undefined> =>
    new Promise((resolve) => {
      try {
        resolve({ url: URL.createObjectURL(file), name: file.name, contentType: file.type || 'application/octet-stream', size: file.size });
      } catch {
        resolve(undefined);
      } finally {
        setUploadQueue((q) => q.filter((n) => n !== file.name));
      }
    });

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!setAttachments) return;
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      setUploadQueue((q) => [...q, ...files.map((f) => f.name)]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      const MAX = 25 * 1024 * 1024;
      const valid = files.filter((f) => f.size <= MAX);
      const uploaded = (await Promise.all(valid.map(uploadFile))).filter(
        (a): a is Attachment => a !== undefined,
      );
      setAttachments((cur) => [...cur, ...uploaded]);
    },
    [setAttachments],
  );

  const handleRemoveAttachment = useCallback(
    (target: Attachment) => {
      if (target.url.startsWith('blob:')) URL.revokeObjectURL(target.url);
      setAttachments?.((cur) => cur.filter((a) => a.url !== target.url || a.name !== target.name));
      textareaRef.current?.focus();
    },
    [setAttachments],
  );

  const submitForm = useCallback(() => {
    if (input.trim().length === 0 && attachments.length === 0) return;
    onSendMessage({ input, attachments });
    setInput('');
    setAttachments?.([]);
    attachments.forEach((a) => a.url.startsWith('blob:') && URL.revokeObjectURL(a.url));
    resetHeight();
    textareaRef.current?.focus();
  }, [input, attachments, onSendMessage, setAttachments, resetHeight]);

  const showSuggestedActions =
    messages.length === 0 && attachments.length === 0 && uploadQueue.length === 0;
  const sendDisabled =
    uploadQueue.length > 0 || !canSend || isGenerating || (input.trim().length === 0 && attachments.length === 0);

  return (
    <div className={cn('relative w-full flex flex-col gap-4', className)}>
      <AnimatePresence>
        {showSuggestedActions && (
          <motion.div
            key="suggested-actions-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <SuggestedActions
              suggestions={suggestions}
              onSelectAction={(action) => {
                setInput(action);
                requestAnimationFrame(() => {
                  adjustHeight();
                  textareaRef.current?.focus();
                });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {allowAttachments && (
        <input
          type="file"
          className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          tabIndex={-1}
          disabled={isGenerating || uploadQueue.length > 0}
          accept="image/*,.pdf"
        />
      )}

      {allowAttachments && (attachments.length > 0 || uploadQueue.length > 0) && (
        <div data-testid="attachments-preview" className="flex pt-[10px] flex-row gap-3 overflow-x-auto items-end pb-2 pl-1">
          {attachments.map((attachment) => (
            <div key={attachment.url || attachment.name} className="relative group">
              <PreviewAttachment attachment={attachment} />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-[-8px] right-[-8px] h-5 w-5 rounded-full p-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveAttachment(attachment)}
                aria-label={`Remove ${attachment.name}`}
              >
                <XIcon className="size-3" />
              </Button>
            </div>
          ))}
          {uploadQueue.map((filename, index) => (
            <PreviewAttachment key={`upload-${filename}-${index}`} attachment={{ url: '', name: filename, contentType: '', size: 0 }} isUploading />
          ))}
        </div>
      )}

      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className={cn(
          'min-h-[24px] max-h-[calc(50dvh)] overflow-y-auto resize-none rounded-2xl !text-base bg-muted border border-border',
          allowAttachments ? 'pb-10 pl-12' : 'pb-10',
        )}
        rows={1}
        autoFocus
        disabled={!canSend || isGenerating || uploadQueue.length > 0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (!sendDisabled) submitForm();
          }
        }}
      />

      {allowAttachments && (
        <div className="absolute bottom-0 left-0 p-2 w-fit flex z-10">
          <Button
            data-testid="attachments-button"
            className="rounded-md p-[7px] h-fit border border-border hover:bg-accent"
            onClick={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
            disabled={isGenerating || uploadQueue.length > 0}
            variant="ghost"
            aria-label="Attach files"
          >
            <PaperclipIcon size={14} />
          </Button>
        </div>
      )}

      <div className="absolute bottom-0 right-0 p-2 w-fit flex justify-end z-10">
        {isGenerating ? (
          <StopButton onStop={onStopGenerating} />
        ) : (
          <SendButton submitForm={submitForm} isDisabled={sendDisabled} />
        )}
      </div>
    </div>
  );
}

export { PureMultimodalInput };
