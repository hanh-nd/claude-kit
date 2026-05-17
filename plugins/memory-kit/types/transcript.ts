export interface Message {
  role: string;
  content: string;
}

export interface Transcript {
  messages: Message[];
}

export interface ContentBlock {
  text?: string;
  output_text?: string;
  input_text?: string;
  type?: string;
}
