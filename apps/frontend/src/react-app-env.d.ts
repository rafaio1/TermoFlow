/// <reference types="react-scripts" />

import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    translate?: 'yes' | 'no';
  }
}
