import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

describe('Card', () => {
  it('should render children', () => {
    render(<Card><p>Card content</p></Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('should apply default padding', () => {
    render(<Card data-testid="card">Test</Card>);
    expect(screen.getByTestId('card').className).toContain('p-6');
  });

  it('should apply small padding', () => {
    render(<Card padding="sm" data-testid="card">Test</Card>);
    expect(screen.getByTestId('card').className).toContain('p-4');
  });

  it('should apply large padding', () => {
    render(<Card padding="lg" data-testid="card">Test</Card>);
    expect(screen.getByTestId('card').className).toContain('p-8');
  });

  it('should apply no padding', () => {
    render(<Card padding="none" data-testid="card">Test</Card>);
    expect(screen.getByTestId('card').className).not.toContain('p-');
  });

  it('should apply hover class', () => {
    render(<Card hover data-testid="card">Test</Card>);
    expect(screen.getByTestId('card').className).toContain('hover:shadow-md');
  });

  it('should apply custom className', () => {
    render(<Card className="custom" data-testid="card">Test</Card>);
    expect(screen.getByTestId('card').className).toContain('custom');
  });

  it('should have base card classes', () => {
    render(<Card data-testid="card">Test</Card>);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-white');
    expect(card.className).toContain('rounded-lg');
    expect(card.className).toContain('border');
  });
});

describe('CardHeader', () => {
  it('should render with border bottom', () => {
    render(<Card><CardHeader data-testid="header">Header</CardHeader></Card>);
    expect(screen.getByTestId('header').className).toContain('border-b');
  });

  it('should render children', () => {
    render(<Card><CardHeader>Title Bar</CardHeader></Card>);
    expect(screen.getByText('Title Bar')).toBeInTheDocument();
  });
});

describe('CardTitle', () => {
  it('should render title text', () => {
    render(<Card><CardTitle>My Title</CardTitle></Card>);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('should be an h3 element', () => {
    render(<Card><CardTitle>Title</CardTitle></Card>);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<Card><CardTitle className="custom">Title</CardTitle></Card>);
    expect(screen.getByText('Title').className).toContain('custom');
  });
});

describe('CardDescription', () => {
  it('should render description text', () => {
    render(<Card><CardDescription>Description text</CardDescription></Card>);
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should have small text styling', () => {
    render(<Card><CardDescription data-testid="desc">Desc</CardDescription></Card>);
    expect(screen.getByTestId('desc').className).toContain('text-sm');
    expect(screen.getByTestId('desc').className).toContain('text-gray-500');
  });
});

describe('CardContent', () => {
  it('should render children', () => {
    render(<Card><CardContent><span>Content</span></CardContent></Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('CardFooter', () => {
  it('should render with border top', () => {
    render(<Card><CardFooter data-testid="footer">Footer</CardFooter></Card>);
    expect(screen.getByTestId('footer').className).toContain('border-t');
  });

  it('should use flex layout', () => {
    render(<Card><CardFooter data-testid="footer">Footer</CardFooter></Card>);
    expect(screen.getByTestId('footer').className).toContain('flex');
  });
});

describe('Card composition', () => {
  it('should compose all subcomponents', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content here</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card Description')).toBeInTheDocument();
    expect(screen.getByText('Main content here')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});
