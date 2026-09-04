import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Table, Column } from '@/components/ui/table';

interface TestItem {
  name: string;
  age: number;
  status: string;
  [key: string]: unknown;
}

const columns: Column<TestItem>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'age', header: 'Age', sortable: true },
  { key: 'status', header: 'Status' },
];

const testData: TestItem[] = [
  { name: 'Alice', age: 30, status: 'active' },
  { name: 'Bob', age: 25, status: 'inactive' },
  { name: 'Charlie', age: 35, status: 'active' },
];

describe('Table', () => {
  it('should render table with data', () => {
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('should show empty message when no data', () => {
    render(<Table data={[]} columns={columns} keyExtractor={(item) => item.name} emptyMessage="No items found" />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<Table data={[]} columns={columns} keyExtractor={(item) => item.name} loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('should handle row click', () => {
    const onRowClick = jest.fn();
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Alice'));
    expect(onRowClick).toHaveBeenCalledWith(testData[0]);
  });

  it('should sort ascending on first click', () => {
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} />);
    fireEvent.click(screen.getByText('Name'));
    const rows = screen.getAllByTestId('table-row');
    expect(rows[0]).toHaveTextContent('Alice');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Charlie');
  });

  it('should sort descending on second click', () => {
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} />);
    fireEvent.click(screen.getByText('Name'));
    fireEvent.click(screen.getByText('Name'));
    const rows = screen.getAllByTestId('table-row');
    expect(rows[0]).toHaveTextContent('Charlie');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Alice');
  });

  it('should show sort indicator', () => {
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} />);
    fireEvent.click(screen.getByText('Name'));
    expect(screen.getByTestId('sort-indicator')).toHaveTextContent('up');
  });

  it('should paginate data', () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      name: `User ${i}`,
      age: 20 + i,
      status: 'active',
    }));
    render(<Table data={manyItems} columns={columns} keyExtractor={(item) => item.name} pageSize={5} />);
    expect(screen.getAllByTestId('table-row')).toHaveLength(5);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('should navigate pages', () => {
    const manyItems = Array.from({ length: 15 }, (_, i) => ({
      name: `User ${i}`,
      age: 20 + i,
      status: 'active',
    }));
    render(<Table data={manyItems} columns={columns} keyExtractor={(item) => item.name} pageSize={5} />);
    fireEvent.click(screen.getByTestId('next-page'));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('should disable previous on first page', () => {
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} pageSize={2} />);
    expect(screen.getByTestId('prev-page')).toBeDisabled();
  });

  it('should disable next on last page', () => {
    render(<Table data={testData} columns={columns} keyExtractor={(item) => item.name} pageSize={10} />);
    expect(screen.getByTestId('next-page')).toBeDisabled();
  });

  it('should render custom cell content', () => {
    const customColumns: Column<TestItem>[] = [
      {
        key: 'name',
        header: 'Name',
        render: (item) => <strong data-testid="custom-cell">{item.name}</strong>,
      },
    ];
    render(<Table data={testData} columns={customColumns} keyExtractor={(item) => item.name} />);
    expect(screen.getByTestId('custom-cell')).toBeInTheDocument();
    expect(screen.getByTestId('custom-cell').tagName).toBe('STRONG');
  });
});
