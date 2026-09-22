"use client";
import { useRef } from "react";

const OTP_LENGTH = 6;

const OtpInput = ({
  register,
  setValue,
  errors,
}: {
  register: any;
  setValue: any;
  errors?: any;
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const value = e.target.value;
    if (!/^[0-9]*$/.test(value)) return;

    if (value.length === 1) {
      // normal typing
      setValue(`otp[${index}]`, value);
      if (index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (
      e.key === "Backspace" &&
      !(e.target as HTMLInputElement).value &&
      index > 0
    ) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData
      .getData("text")
      .trim()
      .slice(0, OTP_LENGTH);
    pasteData.split("").forEach((char, idx) => {
      if (/^[0-9]$/.test(char)) {
        setValue(`otp[${idx}]`, char);
        if (inputsRef.current[idx]) {
          inputsRef.current[idx]!.value = char; // update input visually
        }
      }
    });
    const lastIndex = Math.min(pasteData.length, OTP_LENGTH - 1);
    inputsRef.current[lastIndex]?.focus();
  };

  return (
    <div className="flex gap-3 mb-5">
      {[...Array(OTP_LENGTH)].map((_, index) => (
        <input
          key={index}
          type="text"
          maxLength={1}
          className="relative z-20 w-12 h-12 text-center text-lg bg-slate-100 border border-slate-600 text-slate-600 rounded-xl shadow-inner outline-none focus:ring-2 focus:ring-slate-600 transition-all"
          {...register(`otp[${index}]`, { required: true })}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
};

export default OtpInput;
