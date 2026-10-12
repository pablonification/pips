import { FieldValues, UseFormReturn } from 'react-hook-form';

// react-hook-form now defaults the transformed values to the field values (they were undefined).
// eslint-disable-next-line
export interface FormProps<TFV extends FieldValues, TC = any, TTV = TFV> {
  form: UseFormReturn<TFV, TC, TTV>;
  isOpen: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSubmit: (values: TFV) => void;
  title?: string;
  children: React.ReactNode[] | React.ReactNode;
  constraintRef: React.MutableRefObject<HTMLElement | null>;
}
