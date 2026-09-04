import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInterface, ChatMessage } from '@/components/ai/chat-interface';

const mockMessages: ChatMessage[] = [
  { id: '1', role: 'user', content: 'Hello AI', timestamp: new Date('2026-01-01T12:00:00') },
  { id: '2', role: 'assistant', content: 'Hello! How can I help?', timestamp: new Date('2026-01-01T12:00:01') },
];

describe('ChatInterface', () => {
  it('should render chat interface', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} />);
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
  });

  it('should show empty state when no messages', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });

  it('should render messages', () => {
    render(<ChatInterface messages={mockMessages} onSendMessage={jest.fn()} />);
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
  });

  it('should align user messages to right', () => {
    render(<ChatInterface messages={mockMessages} onSendMessage={jest.fn()} />);
    const userMsg = screen.getByText('Hello AI').closest('.flex');
    expect(userMsg?.className).toContain('justify-end');
  });

  it('should align assistant messages to left', () => {
    render(<ChatInterface messages={mockMessages} onSendMessage={jest.fn()} />);
    const assistantMsg = screen.getByText('Hello! How can I help?').closest('.flex');
    expect(assistantMsg?.className).toContain('justify-start');
  });

  it('should display timestamps', () => {
    render(<ChatInterface messages={mockMessages} onSendMessage={jest.fn()} />);
    expect(screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/).length).toBeGreaterThan(0);
  });

  it('should render chat input', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('should render send button', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} />);
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('should call onSendMessage with input text', () => {
    const onSend = jest.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Test message' } });
    fireEvent.click(screen.getByTestId('send-button'));
    expect(onSend).toHaveBeenCalledWith('Test message');
  });

  it('should clear input after sending', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} />);
    const input = screen.getByTestId('chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('send-button'));
    expect(input.value).toBe('');
  });

  it('should send on Enter key', () => {
    const onSend = jest.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Key send' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Key send');
  });

  it('should not send on Shift+Enter', () => {
    const onSend = jest.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    const input = screen.getByTestId('chat-input');
    fireEvent.change(input, { target: { value: 'Multi' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should not send empty message', () => {
    const onSend = jest.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} />);
    fireEvent.click(screen.getByTestId('send-button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should show loading indicator', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} loading={true} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('should disable input when loading', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} loading={true} />);
    expect(screen.getByTestId('chat-input')).toBeDisabled();
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('should disable input when disabled prop is true', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} disabled={true} />);
    expect(screen.getByTestId('chat-input')).toBeDisabled();
  });

  it('should not send when loading', () => {
    const onSend = jest.fn();
    render(<ChatInterface messages={[]} onSendMessage={onSend} loading={true} />);
    fireEvent.click(screen.getByTestId('send-button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('should render tool calls', () => {
    const messagesWithTools: ChatMessage[] = [
      {
        id: '3',
        role: 'assistant',
        content: 'Let me check that.',
        timestamp: new Date(),
        toolCalls: [{ name: 'get_weather', result: '{"temp": 72}' }],
      },
    ];
    render(<ChatInterface messages={messagesWithTools} onSendMessage={jest.fn()} />);
    expect(screen.getByText('get_weather')).toBeInTheDocument();
  });

  it('should show custom placeholder', () => {
    render(<ChatInterface messages={[]} onSendMessage={jest.fn()} placeholder="Ask me anything" />);
    expect(screen.getByPlaceholderText('Ask me anything')).toBeInTheDocument();
  });

  it('should render system messages with different style', () => {
    const sysMsg: ChatMessage[] = [
      { id: 's1', role: 'system', content: 'System message', timestamp: new Date() },
    ];
    render(<ChatInterface messages={sysMsg} onSendMessage={jest.fn()} />);
    const msg = screen.getByText('System message').closest('.rounded-lg');
    expect(msg?.className).toContain('bg-yellow-50');
  });
});
