"use client";

export function PrintButton() {
  return <button className="ui-button-primary" onClick={() => window.print()}>Print</button>;
}
