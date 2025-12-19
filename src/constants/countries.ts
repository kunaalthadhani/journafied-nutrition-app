export interface Country {
    code: string;
    name: string;
    dial_code: string;
    placeholder: string; // e.g., '50 123 4567'
    maxLength: number;
}

export const COUNTRIES: Country[] = [
    { code: 'AF', name: 'Afghanistan', dial_code: '+93', placeholder: '70 123 4567', maxLength: 9 },
    { code: 'AL', name: 'Albania', dial_code: '+355', placeholder: '69 123 4567', maxLength: 9 },
    { code: 'DZ', name: 'Algeria', dial_code: '+213', placeholder: '555 12 34 56', maxLength: 9 },
    { code: 'AR', name: 'Argentina', dial_code: '+54', placeholder: '9 11 1234 5678', maxLength: 11 }, // Mobile has 9 prefix
    { code: 'AU', name: 'Australia', dial_code: '+61', placeholder: '400 123 456', maxLength: 9 },
    { code: 'AT', name: 'Austria', dial_code: '+43', placeholder: '664 1234567', maxLength: 10 }, // Var
    { code: 'BH', name: 'Bahrain', dial_code: '+973', placeholder: '3900 1234', maxLength: 8 },
    { code: 'BD', name: 'Bangladesh', dial_code: '+880', placeholder: '17 1234 5678', maxLength: 10 },
    { code: 'BE', name: 'Belgium', dial_code: '+32', placeholder: '470 12 34 56', maxLength: 9 },
    { code: 'BR', name: 'Brazil', dial_code: '+55', placeholder: '11 91234 5678', maxLength: 11 },
    { code: 'CA', name: 'Canada', dial_code: '+1', placeholder: '416 555 0199', maxLength: 10 },
    { code: 'CN', name: 'China', dial_code: '+86', placeholder: '139 1234 5678', maxLength: 11 },
    { code: 'CO', name: 'Colombia', dial_code: '+57', placeholder: '300 123 4567', maxLength: 10 },
    { code: 'DK', name: 'Denmark', dial_code: '+45', placeholder: '12 34 56 78', maxLength: 8 },
    { code: 'EG', name: 'Egypt', dial_code: '+20', placeholder: '100 123 4567', maxLength: 10 },
    { code: 'FI', name: 'Finland', dial_code: '+358', placeholder: '40 123 4567', maxLength: 9 }, // Var
    { code: 'FR', name: 'France', dial_code: '+33', placeholder: '6 12 34 56 78', maxLength: 9 },
    { code: 'DE', name: 'Germany', dial_code: '+49', placeholder: '151 23456789', maxLength: 11 }, // Var
    { code: 'GR', name: 'Greece', dial_code: '+30', placeholder: '69 1234 5678', maxLength: 10 },
    { code: 'HK', name: 'Hong Kong', dial_code: '+852', placeholder: '5123 4567', maxLength: 8 },
    { code: 'IN', name: 'India', dial_code: '+91', placeholder: '98765 43210', maxLength: 10 },
    { code: 'ID', name: 'Indonesia', dial_code: '+62', placeholder: '812 3456 7890', maxLength: 11 }, // Var 10-12
    { code: 'IE', name: 'Ireland', dial_code: '+353', placeholder: '87 123 4567', maxLength: 9 },
    { code: 'IT', name: 'Italy', dial_code: '+39', placeholder: '300 123 4567', maxLength: 10 },
    { code: 'JP', name: 'Japan', dial_code: '+81', placeholder: '90 1234 5678', maxLength: 10 },
    { code: 'JO', name: 'Jordan', dial_code: '+962', placeholder: '7 9123 4567', maxLength: 9 },
    { code: 'KZ', name: 'Kazakhstan', dial_code: '+7', placeholder: '701 123 4567', maxLength: 10 },
    { code: 'KE', name: 'Kenya', dial_code: '+254', placeholder: '712 123 456', maxLength: 9 },
    { code: 'KW', name: 'Kuwait', dial_code: '+965', placeholder: '500 12345', maxLength: 8 },
    { code: 'LB', name: 'Lebanon', dial_code: '+961', placeholder: '3 123 456', maxLength: 7 }, // can be 8
    { code: 'MY', name: 'Malaysia', dial_code: '+60', placeholder: '12 345 6789', maxLength: 9 }, // Var 9-10
    { code: 'MX', name: 'Mexico', dial_code: '+52', placeholder: '55 1234 5678', maxLength: 10 },
    { code: 'MA', name: 'Morocco', dial_code: '+212', placeholder: '600 12 34 56', maxLength: 9 },
    { code: 'NL', name: 'Netherlands', dial_code: '+31', placeholder: '6 12345678', maxLength: 9 },
    { code: 'NZ', name: 'New Zealand', dial_code: '+64', placeholder: '21 123 4567', maxLength: 9 }, // Var 8-9
    { code: 'NG', name: 'Nigeria', dial_code: '+234', placeholder: '803 123 4567', maxLength: 10 },
    { code: 'NO', name: 'Norway', dial_code: '+47', placeholder: '400 12 345', maxLength: 8 },
    { code: 'OM', name: 'Oman', dial_code: '+968', placeholder: '9000 1234', maxLength: 8 },
    { code: 'PK', name: 'Pakistan', dial_code: '+92', placeholder: '300 1234567', maxLength: 10 },
    { code: 'PH', name: 'Philippines', dial_code: '+63', placeholder: '917 123 4567', maxLength: 10 },
    { code: 'PT', name: 'Portugal', dial_code: '+351', placeholder: '91 234 5678', maxLength: 9 },
    { code: 'QA', name: 'Qatar', dial_code: '+974', placeholder: '3312 3456', maxLength: 8 },
    { code: 'RU', name: 'Russia', dial_code: '+7', placeholder: '900 123 45 67', maxLength: 10 },
    { code: 'SA', name: 'Saudi Arabia', dial_code: '+966', placeholder: '50 123 4567', maxLength: 9 },
    { code: 'SG', name: 'Singapore', dial_code: '+65', placeholder: '9123 4567', maxLength: 8 },
    { code: 'ZA', name: 'South Africa', dial_code: '+27', placeholder: '82 123 4567', maxLength: 9 },
    { code: 'KR', name: 'South Korea', dial_code: '+82', placeholder: '10 1234 5678', maxLength: 10 },
    { code: 'ES', name: 'Spain', dial_code: '+34', placeholder: '600 12 34 56', maxLength: 9 },
    { code: 'SE', name: 'Sweden', dial_code: '+46', placeholder: '70 123 45 67', maxLength: 9 },
    { code: 'CH', name: 'Switzerland', dial_code: '+41', placeholder: '79 123 45 67', maxLength: 9 },
    { code: 'TR', name: 'Turkey', dial_code: '+90', placeholder: '532 123 45 67', maxLength: 10 },
    { code: 'AE', name: 'United Arab Emirates', dial_code: '+971', placeholder: '50 123 4567', maxLength: 9 },
    { code: 'GB', name: 'United Kingdom', dial_code: '+44', placeholder: '7700 900077', maxLength: 10 },
    { code: 'US', name: 'United States', dial_code: '+1', placeholder: '201 555 0123', maxLength: 10 },
];
