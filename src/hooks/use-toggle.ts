import * as React from "react";

function useToggle(initialValue = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = React.useState(initialValue);

  const toggle = React.useCallback(() => {
    setValue((v) => !v);
  }, []);

  const set = React.useCallback((newValue: boolean) => {
    setValue(newValue);
  }, []);

  return [value, toggle, set];
}

export { useToggle };
