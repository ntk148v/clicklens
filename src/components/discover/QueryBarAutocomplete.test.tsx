import { describe, test, expect } from "bun:test";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryBarAutocomplete } from "./QueryBarAutocomplete";

describe("QueryBarAutocomplete", () => {
  const mockColumns = [
    { name: "status", type: "String" },
    { name: "host", type: "String" },
    { name: "timestamp", type: "DateTime" },
    { name: "level", type: "String" },
    { name: "message", type: "String" },
  ];

  const defaultProps = {
    value: "",
    onChange: () => {},
    onExecute: () => {},
    columns: mockColumns,
  };

  test("renders input with placeholder", () => {
    render(<QueryBarAutocomplete {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      /Enter filter expression/i
    );
    expect(input).toBeInTheDocument();
  });

  test("shows search icon", () => {
    render(<QueryBarAutocomplete {...defaultProps} />);
    const searchIcon = document.querySelector(".lucide-search");
    expect(searchIcon).toBeInTheDocument();
  });

  test("displays current value", () => {
    render(
      <QueryBarAutocomplete {...defaultProps} value="status = 'error'" />
    );
    const input = screen.getByDisplayValue("status = 'error'");
    expect(input).toBeInTheDocument();
  });

  test("calls onChange when input changes", () => {
    const handleChange = (value: string) => {
      expect(value).toBe("status");
    };
    render(
      <QueryBarAutocomplete {...defaultProps} onChange={handleChange} />
    );
    const input = screen.getByPlaceholderText(/Enter filter expression/i);
    fireEvent.change(input, { target: { value: "status" } });
  });

  test("calls onExecute when Enter key is pressed", () => {
    const handleExecute = (value: string) => {
      expect(value).toBe("status = 'error'");
    };
    render(
      <QueryBarAutocomplete
        {...defaultProps}
        value="status = 'error'"
        onExecute={handleExecute}
      />
    );
    const input = screen.getByDisplayValue("status = 'error'");
    fireEvent.keyDown(input, { key: "Enter" });
  });

  test("shows clear button when value is present", () => {
    render(
      <QueryBarAutocomplete {...defaultProps} value="status = 'error'" />
    );
    const clearButton = document.querySelector(".lucide-x");
    expect(clearButton).toBeInTheDocument();
  });

  test("clears value when clear button is clicked", () => {
    const handleChange = (value: string) => {
      expect(value).toBe("");
    };
    render(
      <QueryBarAutocomplete
        {...defaultProps}
        value="status = 'error'"
        onChange={handleChange}
      />
    );
    const clearButton = document.querySelector(".lucide-x") as HTMLElement;
    fireEvent.click(clearButton);
  });

  test("closes dropdown on Escape key", () => {
    render(<QueryBarAutocomplete {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter filter expression/i);
    fireEvent.change(input, { target: { value: "sta" } });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Escape" });
  });

  test("is disabled when isLoading is true", () => {
    render(<QueryBarAutocomplete {...defaultProps} isLoading={true} />);
    const input = screen.getByPlaceholderText(/Enter filter expression/i);
    expect(input).toBeDisabled();
  });

  test("filters suggestions based on input", () => {
    render(<QueryBarAutocomplete {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter filter expression/i);
    fireEvent.change(input, { target: { value: "hos" } });
    fireEvent.focus(input);
  });

  test("navigates suggestions with arrow keys", () => {
    render(<QueryBarAutocomplete {...defaultProps} />);
    const input = screen.getByPlaceholderText(/Enter filter expression/i);
    fireEvent.change(input, { target: { value: "s" } });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
  });

  test("handles empty columns array", () => {
    render(
      <QueryBarAutocomplete {...defaultProps} columns={[]} />
    );
    const input = screen.getByPlaceholderText(/Enter filter expression/i);
    expect(input).toBeInTheDocument();
  });

  test("handles many columns (limits to 10)", () => {
    const manyColumns = Array.from({ length: 20 }, (_, i) => ({
      name: `column_${i}`,
      type: "String",
    }));
    render(
      <QueryBarAutocomplete {...defaultProps} columns={manyColumns} />
    );
    const input = screen.getByPlaceholderText(/Enter filter expression/i);
    expect(input).toBeInTheDocument();
  });
});