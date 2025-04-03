// Common interfaces for API data

export interface HTSChapter {
    chapter: string;
    description: string;
    sections: HTSSection[];
  }
  
  export interface HTSSection {
    code: string;
    description: string;
    rates: HTSRate[];
  }
  
  export interface HTSRate {
    hts_code: string;
    description: string;
    rate: number;
    unit: string;
    special_rates?: {
      program: string;
      rate: number;
    }[];
  }
  
  export interface Section301Tariff {
    hts_code: string;
    rate: number;
    description: string;
    effective_date: string;
    expiry_date?: string;
    list_number: string;
    countries: string[];
  }
  
  export interface Exclusion {
    id: string;
    hts_code: string;
    description: string;
    effective_date: string;
    expiry_date?: string;
  }
  
  export interface TradeAgreement {
    code: string;
    name: string;
    description: string;
    effective_date: string;
    countries: string[];
  }
  
  export interface CBPRuling {
    ruling_number: string;
    date: string;
    title: string;
    description: string;
    hts_codes: string[];
    url: string;
  }
  
  export interface FederalRegisterNotice {
    document_number: string;
    title: string;
    abstract: string;
    publication_date: string;
    effective_date: string;
    html_url: string;
    hts_codes?: string[];
  }