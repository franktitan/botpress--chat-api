/* eslint-disable @next/next/no-img-element */
'use client'

import {
  AttachmentIcon,
  BotIcon,
  UserIcon,
  VercelIcon,
} from "@/components/icons";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { Markdown } from "@/components/markdown";
import * as chat from '@botpress/chat';

function TextFilePreview({ file }: { file: File }) {
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      setContent(typeof text === "string" ? text.slice(0, 100) : "");
    };
    reader.readAsText(file);
  }, [file]);

  return (
    <div>
      {content}
      {content.length >= 100 && "..."}
    </div>
  );
}

const webhookId: string | undefined = process.env.NEXT_PUBLIC_WEBHOOK_ID;

if (!webhookId) {
  throw new Error('WEBHOOK_ID is required')
}

export default function Home() {
  const [files, setFiles] = useState<FileList | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Reference for the hidden file input
  const [isDragging, setIsDragging] = useState(false);
  const [client, setClient] = useState<chat.AuthenticatedClient | undefined>();
  const [conversation, setConversation] = useState<chat.Conversation | undefined>();
  const [messages, setMessages] = useState<chat.Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [listener, setListener] = useState<chat.SignalListener | undefined>();

  useEffect(() => {
    if (!client) {
      chat.Client.connect({ webhookId: encodeURIComponent(webhookId || '') }).then(setClient);
    }
  }, []);

  useEffect(() => {
    if (client && !conversation) {
      client.createConversation({}).then(res => {
        setConversation(res.conversation);
        client.listenConversation({ id: res.conversation.id }).then(listener => {
          setListener(listener);
          const onMessage = (ev: chat.Signals['message_created']) => {
            if (ev.userId === client.user.id) {
              // message created by my current user, ignoring...
              return
            }
            setIsLoading(false);
//            console.log(ev,messages);
            messages.push(ev);
          }
          listener.on('message_created', onMessage)
          listener.on('error', (err) => {
            console.error('connection lost', err)
            //void onDisconnection()
          });        
        });
      });
    }
  }, [client]);

  const onDisconnection = async () => {
    try {
      if (listener && client && conversation) {
        await listener.connect()
        const { messages } = await client.listMessages({ conversationId: conversation.id })
        setMessages(messages);
      }
    } catch (thrown) {
      console.error('failed to reconnect, retrying...', thrown)
      setTimeout(onDisconnection, 10000) // consider using a backoff strategy
    }
  }  

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.value) {
      setInput(event.currentTarget.value);
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;

    if (items) {
      const files = Array.from(items)
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        const validFiles = files.filter(
          (file) =>
            file.type.startsWith("image/") || file.type.startsWith("text/")
        );

        if (validFiles.length === files.length) {
          const dataTransfer = new DataTransfer();
          validFiles.forEach((file) => dataTransfer.items.add(file));
          setFiles(dataTransfer.files);
        } else {
          toast.error("Only image and text files are allowed");
        }
      }
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = event.dataTransfer.files;
    const droppedFilesArray = Array.from(droppedFiles);
    if (droppedFilesArray.length > 0) {
      const validFiles = droppedFilesArray.filter(
        (file) =>
          file.type.startsWith("image/") || file.type.startsWith("text/")
      );

      if (validFiles.length === droppedFilesArray.length) {
        const dataTransfer = new DataTransfer();
        validFiles.forEach((file) => dataTransfer.items.add(file));
        setFiles(dataTransfer.files);
      } else {
        toast.error("Only image and text files are allowed!");
      }

      setFiles(droppedFiles);
    }
    setIsDragging(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to handle file selection via the upload button
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Function to handle files selected from the file dialog
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles) {
      const validFiles = Array.from(selectedFiles).filter(
        (file) =>
          file.type.startsWith("image/") || file.type.startsWith("text/")
      );

      if (validFiles.length === selectedFiles.length) {
        const dataTransfer = new DataTransfer();
        validFiles.forEach((file) => dataTransfer.items.add(file));
        setFiles(dataTransfer.files);
      } else {
        toast.error("Only image and text files are allowed");
      }
    }
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>, options: { experimental_attachments: FileList; } | { experimental_attachments?: undefined; }) {
    if (client && conversation) {
      client.createMessage({
        conversationId: conversation.id,
        payload: {
          type: 'text',
          text: input || '',
        },
      }).then(message => messages.push(message.message));
      setInput('');
      setIsLoading(true);
    }
  }

  return (
    <div
      className="flex flex-row justify-center pb-20 h-dvh bg-white dark:bg-zinc-900"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="fixed pointer-events-none dark:bg-zinc-900/90 h-dvh w-dvw z-10 flex flex-row justify-center items-center flex flex-col gap-1 bg-zinc-100/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div>Drag and drop files here</div>
            <div className="text-sm dark:text-zinc-400 text-zinc-500">
              {"(images and text)"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col justify-between gap-4">
        {messages.length > 0 ? (
          <div className="flex flex-col gap-2 h-full w-dvw items-center overflow-y-scroll">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                className={`flex flex-row gap-2 px-4 w-full md:w-[500px] md:px-0 ${
                  index === 0 ? "pt-20" : ""
                }`}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <div className="size-[24px] flex flex-col justify-center items-center flex-shrink-0 text-zinc-400">
                  {message.userId !== client?.user.id ? <BotIcon /> : <UserIcon />}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4">
                    <Markdown>{message.payload.text}</Markdown>
                  </div>
                  <div className="flex flex-row gap-2">
                    {(message.payload.imageUrl ? (
                        <img
                          className="rounded-md w-40 mb-3"
                          key={message.id}
                          src={message.payload.imageUrl}
                          alt={message.payload.text}
                        />
                      ) : message.payload.fileUrl ? (
                        <div className="text-xs w-40 h-24 overflow-hidden text-zinc-400 border p-2 rounded-md dark:bg-zinc-800 dark:border-zinc-700 mb-3">
                          <a href={message.payload.fileUrl}>Download file</a>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            {isLoading &&
              messages[messages.length - 1].userId === client?.user.id && (
                <div className="flex flex-row gap-2 px-4 w-full md:w-[500px] md:px-0">
                  <div className="size-[24px] flex flex-col justify-center items-center flex-shrink-0 text-zinc-400">
                    <BotIcon />
                  </div>
                  <div className="flex flex-col gap-1 text-zinc-400">
                    <div>hmm...</div>
                  </div>
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>
        ) : (
          <motion.div className="h-[350px] px-4 w-full md:w-[500px] md:px-0 pt-20">
            <div className="border rounded-lg p-6 flex flex-col gap-4 text-zinc-500 text-sm dark:text-zinc-400 dark:border-zinc-700">
              <p className="flex flex-row justify-center gap-4 items-center text-zinc-900 dark:text-zinc-50">
                <VercelIcon />
                <span>+</span>
                <AttachmentIcon />
              </p>
              <p>
                This UI uses the @botpress/chat SDK to integrate with the botpress Chat API 
              </p>
              <p>
                {" "}
                Learn more about the{" "}
                <Link
                  className="text-blue-500 dark:text-blue-400"
                  href="https://www.npmjs.com/package/@botpress/chat?ajs_aid=%24device%3A50f4e983-ecf7-45ec-a8a7-8a876f83bfa2"
                  target="_blank"
                >
                  @botpress/chat{" "}
                </Link>
                npm package.
              </p>
            </div>
          </motion.div>
        )}

        <form
          className="flex flex-col gap-2 relative items-center"
          onSubmit={(event) => {
            const options = files ? { experimental_attachments: files } : {};
            handleSubmit(event, options);
            setFiles(null);
            event.preventDefault();
          }}
        >
          <AnimatePresence>
            {files && files.length > 0 && (
              <div className="flex flex-row gap-2 absolute bottom-12 px-4 w-full md:w-[500px] md:px-0">
                {Array.from(files).map((file) =>
                  file.type.startsWith("image") ? (
                    <div key={file.name}>
                      <motion.img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="rounded-md w-16"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{
                          y: -10,
                          scale: 1.1,
                          opacity: 0,
                          transition: { duration: 0.2 },
                        }}
                      />
                    </div>
                  ) : file.type.startsWith("text") ? (
                    <motion.div
                      key={file.name}
                      className="text-[8px] leading-1 w-28 h-16 overflow-hidden text-zinc-500 border p-2 rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{
                        y: -10,
                        scale: 1.1,
                        opacity: 0,
                        transition: { duration: 0.2 },
                      }}
                    >
                      <TextFilePreview file={file} />
                    </motion.div>
                  ) : null
                )}
              </div>
            )}
          </AnimatePresence>

          {/* Hidden file input */}
          <input
            type="file"
            multiple
            accept="image/*,text/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex items-center w-full md:max-w-[500px] max-w-[calc(100dvw-32px)] bg-zinc-100 dark:bg-zinc-700 rounded-full px-4 py-2">
            {/* Upload Button */}
            <button
              type="button"
              onClick={handleUploadClick}
              className="text-zinc-500 dark:text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-100 focus:outline-none mr-3"
              aria-label="Upload Files"
            >
              <span className="w-5 h-5">
                <AttachmentIcon aria-hidden="true" />
              </span>
            </button>

            {/* Message Input */}
            <input
              ref={inputRef}
              className="bg-transparent flex-grow outline-none text-zinc-800 dark:text-zinc-300 placeholder-zinc-400"
              placeholder="Send a message..."
              value={input}
              onChange={handleInputChange}
              onPaste={handlePaste}
            />
          </div>
        </form>
      </div>
    </div>
  );
}