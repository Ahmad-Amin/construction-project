"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import { PhoneInput as CountryPhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { Spinner } from "@/components/spinner";
import { toE164 } from "@/lib/phone";

// A phone field with a country picker (flag, search, dial code) that formats the number as you
// type. The picker starts on `defaultCountry`, and the hint shows an example number for whichever
// country is selected. It submits the international number (+923001234567)
// under `name`, or nothing when left empty. The dial code lives in the picker, so people type
// just their own number, with or without the leading 0.
export function PhoneField({
  name,
  defaultValue = "",
  defaultCountry = "pk",
}: {
  name: string;
  // A saved number, in any format we have ever stored.
  defaultValue?: string;
  defaultCountry?: string;
}) {
  const [phone, setPhone] = useState(() => toE164(defaultValue) ?? "");
  const [dialCode, setDialCode] = useState(() => {
    const saved = parsePhoneNumberFromString(toE164(defaultValue) ?? "");
    return saved?.countryCallingCode ?? getCountryCallingCode(defaultCountry.toUpperCase() as CountryCode);
  });
  const [leftField, setLeftField] = useState(false);
  const [selected, setSelected] = useState(() => parsePhoneNumberFromString(toE164(defaultValue) ?? "")?.country ?? (defaultCountry.toUpperCase() as CountryCode));
  // A sample number in the selected country's own format, as the hint inside the field.
  const example = getExampleNumber(selected, examples)?.formatNational();

  // While nothing is typed the picker reports just the dial code ("+92").
  const hasNumber = phone.replace(/\D/g, "").length > String(dialCode).length;
  const valid = toE164(phone) !== null;
  // After the person leaves the field the number is checked. That check is instant, but the
  // result appears after a short "Checking…" moment, so a verdict doesn't flash in and out.
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const settled = leftField && hasNumber && !checking;
  const showError = settled && !valid;
  const showValid = settled && valid;

  return (
    <div className="phone-field">
      <div className="relative" data-status={checking ? "checking" : showValid ? "valid" : undefined}>
        <CountryPhoneInput
          defaultCountry={defaultCountry}
          value={phone}
          onChange={(value, { country }) => {
            // Once the number is complete, drop a leading 0 (0300… becomes +92 300…).
            const parsed = parsePhoneNumberFromString(value);
            setPhone(parsed?.isValid() ? parsed.number : value);
            setDialCode(country.dialCode);
            setSelected(country.iso2.toUpperCase() as CountryCode);
            setLeftField(false);
            if (timer.current) clearTimeout(timer.current);
            setChecking(false);
          }}
          placeholder={example}
          disableDialCodeAndPrefix
          allowMaskOverflow
          showDisabledDialCodeAndPrefix
          inputProps={{
            type: "tel",
            autoComplete: "tel",
            "aria-invalid": showError || undefined,
            onBlur: () => {
              setLeftField(true);
              if (!hasNumber) return;
              setChecking(true);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setChecking(false), 450);
            },
          }}
          style={{ width: "100%" }}
        />
        {(checking || showValid) && (
          <span
            role="status"
            className={`pointer-events-none absolute inset-y-0 right-3 flex items-center ${checking ? "text-muted" : "text-success"}`}
          >
            {checking ? <Spinner className="size-4" /> : <Check className="size-4" aria-hidden />}
            <span className="sr-only">{checking ? "Checking the number" : "Number looks valid"}</span>
          </span>
        )}
      </div>
      <input type="hidden" name={name} value={hasNumber ? phone : ""} />
      {showError && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          That doesn&apos;t look like a valid number for this country.
        </p>
      )}
    </div>
  );
}
