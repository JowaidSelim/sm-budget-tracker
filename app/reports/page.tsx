"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

type Production = {
  id: string;
  production_name: string;
  stage_manager: string;
  assistant_stage_manager: string | null;
  vat_rate: number;
  allocation_date: string | null;
};

type ProductionBudget = {
  production_id: string;
  original_budget: number;
};

type Membership = {
  can_export_reports: boolean;
  can_view_budget: boolean;
  can_view_props: boolean;
  can_view_stage_management: boolean;
};

type BudgetAllocation = {
  id: string;
  production_id: string;
  name: string;
  category: string;
  allocated_amount: number;
  assigned_user_id: string | null;
};

type Purchase = {
  id: string;
  production_id: string;
  allocation_id: string | null;
  receipt: string;
  purchase_date: string;
  category: string;
  item: string;
  payment_method: string;
  supplier: string;
  total_including_vat: number;
};

type ReportMode =
  | "full"
  | "scoped"
  | "none";

export default function ReportsPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [
    production,
    setProduction,
  ] = useState<Production | null>(
    null
  );

  const [
    membership,
    setMembership,
  ] = useState<Membership | null>(
    null
  );

  const [
    masterBudget,
    setMasterBudget,
  ] = useState<number | null>(
    null
  );

  const [
    allocations,
    setAllocations,
  ] = useState<
    BudgetAllocation[]
  >([]);

  const [
    purchases,
    setPurchases,
  ] = useState<Purchase[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    exporting,
    setExporting,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  useEffect(() => {
    loadReportData();
  }, []);

  async function loadReportData() {
    setLoading(true);
    setMessage("");

    const activeProductionId =
      localStorage.getItem(
        "activeProductionId"
      );

    if (!activeProductionId) {
      setProduction(null);
      setMembership(null);
      setMasterBudget(null);
      setAllocations([]);
      setPurchases([]);
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (
      userError ||
      !user
    ) {
      setMessage(
        "Could not identify the signed-in user."
      );

      setLoading(false);
      return;
    }

    /*
      Membership determines what financial
      areas this user may report on.
    */
    const {
      data: membershipData,
      error: membershipError,
    } = await supabase
      .from(
        "production_members"
      )
      .select(`
        can_export_reports,
        can_view_budget,
        can_view_props,
        can_view_stage_management
      `)
      .eq(
        "production_id",
        activeProductionId
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

    if (
      membershipError ||
      !membershipData
    ) {
      console.error(
        membershipError
      );

      setMessage(
        "Could not load your production permissions."
      );

      setLoading(false);
      return;
    }

    const currentMembership =
      membershipData as Membership;

    setMembership(
      currentMembership
    );

    /*
      If reports are not permitted,
      stop here.
    */
    if (
      !currentMembership.can_export_reports
    ) {
      setLoading(false);
      return;
    }

    const {
      data: productionData,
      error: productionError,
    } = await supabase
      .from("productions")
      .select(`
        id,
        production_name,
        stage_manager,
        assistant_stage_manager,
        vat_rate,
        allocation_date
      `)
      .eq(
        "id",
        activeProductionId
      )
      .single();

    if (
      productionError ||
      !productionData
    ) {
      console.error(
        productionError
      );

      setMessage(
        "Could not load the active production."
      );

      setLoading(false);
      return;
    }

    setProduction(
      productionData as Production
    );

    /*
      Master budget is separate and
      protected by its own RLS.
    */
    if (
      currentMembership.can_view_budget
    ) {
      const {
        data: budgetData,
        error: budgetError,
      } = await supabase
        .from(
          "production_budgets"
        )
        .select(`
          production_id,
          original_budget
        `)
        .eq(
          "production_id",
          activeProductionId
        )
        .maybeSingle();

      if (budgetError) {
        console.error(
          budgetError
        );
      }

      const secureBudget =
        budgetData as
          | ProductionBudget
          | null;

      setMasterBudget(
        secureBudget
          ? Number(
              secureBudget.original_budget
            )
          : null
      );
    } else {
      setMasterBudget(null);
    }

    /*
      TEAM-BASED ALLOCATION VISIBILITY

      SQL 22 makes category permission
      the working boundary.

      Example:
      can_view_props = true

      → all Props allocations visible
      → regardless of assigned_user_id

      assigned_user_id remains useful
      as responsibility information,
      not a security boundary.
    */
    const {
      data: allocationData,
      error: allocationError,
    } = await supabase
      .from(
        "budget_allocations"
      )
      .select(`
        id,
        production_id,
        name,
        category,
        allocated_amount,
        assigned_user_id
      `)
      .eq(
        "production_id",
        activeProductionId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (allocationError) {
      console.error(
        allocationError
      );

      setMessage(
        "Some budget allocation information could not be loaded."
      );
    }

    const visibleAllocations =
      (allocationData as
        BudgetAllocation[]) ??
      [];

    setAllocations(
      visibleAllocations
    );

    /*
      TEAM-BASED PURCHASE VISIBILITY

      Purchase RLS determines which
      categories the user may see.

      Multiple team members with the
      same category permission work
      from the same purchase data.
    */
    const {
      data: purchaseData,
      error: purchaseError,
    } = await supabase
      .from("purchases")
      .select(`
        id,
        production_id,
        allocation_id,
        receipt,
        purchase_date,
        category,
        item,
        payment_method,
        supplier,
        total_including_vat
      `)
      .eq(
        "production_id",
        activeProductionId
      )
      .order(
        "purchase_date",
        {
          ascending: true,
        }
      );

    if (purchaseError) {
      console.error(
        purchaseError
      );

      setMessage(
        "Could not load purchases."
      );

      setPurchases([]);
      setLoading(false);
      return;
    }

    const visiblePurchases =
      (purchaseData as Purchase[]) ??
      [];

    setPurchases(
      visiblePurchases
    );

    setLoading(false);
  }

  function money(
    value: number
  ) {
    return `AED ${value.toLocaleString(
      "en-AE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  function normalizePaymentMethod(
    value: string
  ) {
    return value
      .trim()
      .toLowerCase();
  }

  const reportMode:
    ReportMode =
    !membership ||
    !membership.can_export_reports
      ? "none"
      : membership.can_view_budget
        ? "full"
        : "scoped";

  const propsPurchases =
    purchases.filter(
      (purchase) =>
        purchase.category ===
        "Props"
    );

  const stageManagementPurchases =
    purchases.filter(
      (purchase) =>
        purchase.category ===
        "Stage Management"
    );

  const visibleCategories =
    [
      membership?.can_view_props
        ? "Props"
        : null,

      membership
        ?.can_view_stage_management
        ? "Stage Management"
        : null,
    ].filter(
      Boolean
    ) as string[];

  /*
    For a scoped report, this now
    represents the total budget of
    all allocations the member's
    category permissions allow them
    to access.
  */
  const scopedAllocatedBudget =
    allocations.reduce(
      (
        total,
        allocation
      ) =>
        total +
        Number(
          allocation.allocated_amount
        ),
      0
    );

  const totalSpent =
    purchases.reduce(
      (
        total,
        purchase
      ) =>
        total +
        Number(
          purchase.total_including_vat
        ),
      0
    );

  const reportBudget =
    reportMode === "full"
      ? masterBudget
      : scopedAllocatedBudget;

  const remainingBudget =
    reportBudget !== null
      ? reportBudget -
        totalSpent
      : null;

  const propsTotal =
    propsPurchases.reduce(
      (
        total,
        purchase
      ) =>
        total +
        Number(
          purchase.total_including_vat
        ),
      0
    );

  const stageManagementTotal =
    stageManagementPurchases.reduce(
      (
        total,
        purchase
      ) =>
        total +
        Number(
          purchase.total_including_vat
        ),
      0
    );

  async function handleExcelExport() {
    if (!production) {
      return;
    }

    if (!membership) {
      return;
    }

    if (
      !membership.can_export_reports
    ) {
      return;
    }

    const currentProduction =
      production;

    const currentReportMode =
      reportMode;

    setExporting(true);
    setMessage("");

    try {
      const ExcelJSModule =
        await import("exceljs");

      const ExcelJS =
        ExcelJSModule.default;

      const workbook =
        new ExcelJS.Workbook();

      workbook.creator =
        "SM Budget Tracker";

      workbook.created =
        new Date();

      workbook.calcProperties.fullCalcOnLoad =
        true;

      const vatRate =
        Number(
          currentProduction.vat_rate
        );

      const headerFill =
        "FF0F172A";

      const lightFill =
        "FFF1F5F9";

      const noteFill =
        "FFE2E8F0";

      function styleTableHeader(
        row: any
      ) {
        row.eachCell(
          (cell: any) => {
            cell.font = {
              bold: true,
              color: {
                argb:
                  "FFFFFFFF",
              },
            };

            cell.fill = {
              type:
                "pattern",
              pattern:
                "solid",
              fgColor: {
                argb:
                  headerFill,
              },
            };

            cell.alignment = {
              vertical:
                "middle",
              horizontal:
                "center",
            };
          }
        );
      }

      function addPurchaseSheet(
        sheetName: string,
        sheetPurchases: Purchase[]
      ) {
        const worksheet =
          workbook.addWorksheet(
            sheetName
          );

        worksheet.mergeCells(
          "A1:H1"
        );

        worksheet.getCell(
          "A1"
        ).value =
          sheetName;

        worksheet.getCell(
          "A1"
        ).font = {
          bold: true,
          size: 18,
          color: {
            argb:
              "FFFFFFFF",
          },
        };

        worksheet.getCell(
          "A1"
        ).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              headerFill,
          },
        };

        worksheet.getCell(
          "A3"
        ).value =
          "Production";

        worksheet.getCell(
          "B3"
        ).value =
          currentProduction.production_name;

        worksheet.getCell(
          "A4"
        ).value =
          "VAT Rate";

        worksheet.getCell(
          "B4"
        ).value =
          vatRate / 100;

        worksheet.getCell(
          "B4"
        ).numFmt =
          "0.00%";

        worksheet.mergeCells(
          "A5:H5"
        );

        worksheet.getCell(
          "A5"
        ).value =
          currentReportMode ===
          "full"
            ? "Full production report exported from SM Budget Tracker."
            : "Authorized report containing only the budget areas and purchases this user is permitted to access.";

        worksheet.getCell(
          "A5"
        ).font = {
          italic: true,
          size: 10,
          color: {
            argb:
              "FF475569",
          },
        };

        worksheet.getCell(
          "A5"
        ).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              noteFill,
          },
        };

        const headerRow =
          worksheet.getRow(
            7
          );

        headerRow.values = [
          "Receipt / Invoice",
          "Date",
          "Item",
          "Supplier",
          "Payment Method",
          "Total Incl. VAT",
          "Before VAT",
          "VAT",
        ];

        styleTableHeader(
          headerRow
        );

        sheetPurchases.forEach(
          (
            purchase,
            index
          ) => {
            const rowNumber =
              8 +
              index;

            const row =
              worksheet.getRow(
                rowNumber
              );

            row.getCell(
              1
            ).value =
              purchase.receipt;

            row.getCell(
              2
            ).value =
              new Date(
                `${purchase.purchase_date}T00:00:00`
              );

            row.getCell(
              2
            ).numFmt =
              "dd-mmm-yyyy";

            row.getCell(
              3
            ).value =
              purchase.item;

            row.getCell(
              4
            ).value =
              purchase.supplier;

            row.getCell(
              5
            ).value =
              purchase.payment_method;

            row.getCell(
              6
            ).value =
              Number(
                purchase.total_including_vat
              );

            row.getCell(
              7
            ).value = {
              formula:
                `F${rowNumber}/(1+$B$4)`,
            };

            row.getCell(
              8
            ).value = {
              formula:
                `F${rowNumber}-G${rowNumber}`,
            };

            row.getCell(
              6
            ).numFmt =
              "#,##0.00";

            row.getCell(
              7
            ).numFmt =
              "#,##0.00";

            row.getCell(
              8
            ).numFmt =
              "#,##0.00";
          }
        );

        const firstDataRow =
          8;

        const lastDataRow =
          sheetPurchases.length >
          0
            ? 7 +
              sheetPurchases.length
            : 8;

        const totalRow =
          lastDataRow +
          2;

        worksheet.getCell(
          `E${totalRow}`
        ).value =
          "TOTAL";

        if (
          sheetPurchases.length >
          0
        ) {
          worksheet.getCell(
            `F${totalRow}`
          ).value = {
            formula:
              `SUM(F${firstDataRow}:F${lastDataRow})`,
          };

          worksheet.getCell(
            `G${totalRow}`
          ).value = {
            formula:
              `SUM(G${firstDataRow}:G${lastDataRow})`,
          };

          worksheet.getCell(
            `H${totalRow}`
          ).value = {
            formula:
              `SUM(H${firstDataRow}:H${lastDataRow})`,
          };
        } else {
          worksheet.getCell(
            `F${totalRow}`
          ).value =
            0;

          worksheet.getCell(
            `G${totalRow}`
          ).value =
            0;

          worksheet.getCell(
            `H${totalRow}`
          ).value =
            0;
        }

        for (
          let column =
            5;
          column <=
          8;
          column++
        ) {
          const cell =
            worksheet.getCell(
              totalRow,
              column
            );

          cell.font = {
            bold: true,
          };

          cell.fill = {
            type:
              "pattern",
            pattern:
              "solid",
            fgColor: {
              argb:
                lightFill,
            },
          };

          if (
            column >=
            6
          ) {
            cell.numFmt =
              "#,##0.00";
          }
        }

        worksheet.columns = [
          {
            width: 20,
          },
          {
            width: 16,
          },
          {
            width: 32,
          },
          {
            width: 24,
          },
          {
            width: 22,
          },
          {
            width: 18,
          },
          {
            width: 18,
          },
          {
            width: 16,
          },
        ];

        return totalRow;
      }

      /*
        ===================================================
        FULL PRODUCTION EXPORT
        ===================================================
      */

      if (
        currentReportMode ===
        "full"
      ) {
        if (
          masterBudget ===
          null
        ) {
          throw new Error(
            "Master budget unavailable."
          );
        }

        const overall =
          workbook.addWorksheet(
            "Overall Budget Tracker"
          );

        const propsTotalRow =
          addPurchaseSheet(
            "Props Expenditure",
            propsPurchases
          );

        const smTotalRow =
          addPurchaseSheet(
            "Stage Management Expenditure",
            stageManagementPurchases
          );

        const pettyCash =
          purchases.filter(
            (purchase) =>
              normalizePaymentMethod(
                purchase.payment_method
              ) ===
              "petty cash"
          );

        const creditCard =
          purchases.filter(
            (purchase) =>
              normalizePaymentMethod(
                purchase.payment_method
              ) ===
              "credit card"
          );

        const purchaseOrder =
          purchases.filter(
            (purchase) =>
              normalizePaymentMethod(
                purchase.payment_method
              ) ===
              "purchase order"
          );

        const pettyCashTotalRow =
          addPurchaseSheet(
            "Petty Cash Purchases",
            pettyCash
          );

        const creditCardTotalRow =
          addPurchaseSheet(
            "Credit Card Purchases",
            creditCard
          );

        const poTotalRow =
          addPurchaseSheet(
            "Purchase Order Purchases",
            purchaseOrder
          );

        overall.mergeCells(
          "A1:D1"
        );

        overall.getCell(
          "A1"
        ).value =
          "Overall Budget Tracker";

        overall.getCell(
          "A1"
        ).font = {
          bold: true,
          size: 20,
          color: {
            argb:
              "FFFFFFFF",
          },
        };

        overall.getCell(
          "A1"
        ).fill = {
          type:
            "pattern",
          pattern:
            "solid",
          fgColor: {
            argb:
              headerFill,
          },
        };

        overall.getCell(
          "A3"
        ).value =
          "Production";

        overall.getCell(
          "B3"
        ).value =
          currentProduction.production_name;

        overall.getCell(
          "A4"
        ).value =
          "Stage Manager";

        overall.getCell(
          "B4"
        ).value =
          currentProduction.stage_manager;

        overall.getCell(
          "A5"
        ).value =
          "Assistant Stage Manager";

        overall.getCell(
          "B5"
        ).value =
          currentProduction.assistant_stage_manager ??
          "";

        overall.getCell(
          "A7"
        ).value =
          "Master Budget";

        overall.getCell(
          "B7"
        ).value =
          masterBudget;

        overall.getCell(
          "A9"
        ).value =
          "Props Expenditure";

        overall.getCell(
          "B9"
        ).value = {
          formula:
            `'Props Expenditure'!F${propsTotalRow}`,
        };

        overall.getCell(
          "A10"
        ).value =
          "Stage Management Expenditure";

        overall.getCell(
          "B10"
        ).value = {
          formula:
            `'Stage Management Expenditure'!F${smTotalRow}`,
        };

        overall.getCell(
          "A11"
        ).value =
          "Total Expenditure";

        overall.getCell(
          "B11"
        ).value = {
          formula:
            "SUM(B9:B10)",
        };

        overall.getCell(
          "A12"
        ).value =
          "Remaining Budget";

        overall.getCell(
          "B12"
        ).value = {
          formula:
            "B7-B11",
        };

        overall.getCell(
          "A15"
        ).value =
          "Petty Cash";

        overall.getCell(
          "B15"
        ).value = {
          formula:
            `'Petty Cash Purchases'!F${pettyCashTotalRow}`,
        };

        overall.getCell(
          "A16"
        ).value =
          "Credit Card";

        overall.getCell(
          "B16"
        ).value = {
          formula:
            `'Credit Card Purchases'!F${creditCardTotalRow}`,
        };

        overall.getCell(
          "A17"
        ).value =
          "Purchase Order";

        overall.getCell(
          "B17"
        ).value = {
          formula:
            `'Purchase Order Purchases'!F${poTotalRow}`,
        };

        [
          7,
          9,
          10,
          11,
          12,
          15,
          16,
          17,
        ].forEach(
          (
            row
          ) => {
            overall.getCell(
              `B${row}`
            ).numFmt =
              "#,##0.00";
          }
        );

        overall.columns = [
          {
            width: 34,
          },
          {
            width: 24,
          },
          {
            width: 4,
          },
          {
            width: 18,
          },
        ];
      }

      /*
        ===================================================
        AUTHORIZED / RESTRICTED EXPORT
        ===================================================
      */

      if (
        currentReportMode ===
        "scoped"
      ) {
        const summary =
          workbook.addWorksheet(
            "Budget Summary"
          );

        summary.mergeCells(
          "A1:D1"
        );

        summary.getCell(
          "A1"
        ).value =
          "Authorized Budget Report";

        summary.getCell(
          "A1"
        ).font = {
          bold: true,
          size: 20,
          color: {
            argb:
              "FFFFFFFF",
          },
        };

        summary.getCell(
          "A1"
        ).fill = {
          type:
            "pattern",
          pattern:
            "solid",
          fgColor: {
            argb:
              headerFill,
          },
        };

        summary.getCell(
          "A3"
        ).value =
          "Production";

        summary.getCell(
          "B3"
        ).value =
          currentProduction.production_name;

        summary.getCell(
          "A5"
        ).value =
          "Accessible Budget";

        summary.getCell(
          "B5"
        ).value =
          scopedAllocatedBudget;

        summary.getCell(
          "A6"
        ).value =
          "Spent";

        summary.getCell(
          "B6"
        ).value =
          totalSpent;

        summary.getCell(
          "A7"
        ).value =
          "Remaining";

        summary.getCell(
          "B7"
        ).value =
          scopedAllocatedBudget -
          totalSpent;

        summary.getCell(
          "A9"
        ).value =
          "Authorized Areas";

        summary.getCell(
          "B9"
        ).value =
          visibleCategories.join(
            ", "
          );

        [
          5,
          6,
          7,
        ].forEach(
          (
            row
          ) => {
            summary.getCell(
              `B${row}`
            ).numFmt =
              "#,##0.00";
          }
        );

        summary.columns = [
          {
            width: 30,
          },
          {
            width: 28,
          },
        ];

        if (
          membership.can_view_props
        ) {
          addPurchaseSheet(
            "Props Purchases",
            propsPurchases
          );
        }

        if (
          membership
            .can_view_stage_management
        ) {
          addPurchaseSheet(
            "Stage Management Purchases",
            stageManagementPurchases
          );
        }

        const pettyCash =
          purchases.filter(
            (purchase) =>
              normalizePaymentMethod(
                purchase.payment_method
              ) ===
              "petty cash"
          );

        const creditCard =
          purchases.filter(
            (purchase) =>
              normalizePaymentMethod(
                purchase.payment_method
              ) ===
              "credit card"
          );

        const purchaseOrder =
          purchases.filter(
            (purchase) =>
              normalizePaymentMethod(
                purchase.payment_method
              ) ===
              "purchase order"
          );

        addPurchaseSheet(
          "Petty Cash Purchases",
          pettyCash
        );

        addPurchaseSheet(
          "Credit Card Purchases",
          creditCard
        );

        addPurchaseSheet(
          "Purchase Order Purchases",
          purchaseOrder
        );
      }

      const buffer =
        await workbook.xlsx.writeBuffer();

      const blob =
        new Blob(
          [
            buffer as BlobPart,
          ],
          {
            type:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }
        );

      const safeName =
        currentProduction
          .production_name
          .replace(
            /[^a-z0-9]+/gi,
            "-"
          )
          .replace(
            /^-+|-+$/g,
            ""
          );

      const suffix =
        currentReportMode ===
        "full"
          ? "budget"
          : "authorized-budget";

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `${
          safeName ||
          "production"
        }-${suffix}.xlsx`;

      document.body.appendChild(
        link
      );

      link.click();

      document.body.removeChild(
        link
      );

      URL.revokeObjectURL(
        url
      );

      setMessage(
        "Excel workbook exported successfully."
      );
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        "Could not create the Excel workbook."
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <main className="p-6 md:p-10">

        <p className="text-slate-500">
          Loading reports...
        </p>

      </main>
    );
  }

  if (
    reportMode ===
    "none"
  ) {
    return (
      <main className="p-6 text-slate-900 md:p-10">

        <div className="mx-auto max-w-5xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-semibold">
              Reports unavailable
            </p>

            <p className="mt-2 text-sm text-slate-500">
              You do not have permission to export reports for this production.
            </p>

          </div>

        </div>

      </main>
    );
  }

  if (!production) {
    return (
      <main className="p-6 text-slate-900 md:p-10">

        <div className="mx-auto max-w-5xl">

          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">

            <p className="text-lg font-semibold">
              No active production
            </p>

          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 text-slate-900 md:p-10">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8">

          <h1 className="text-3xl font-bold">
            Reports
          </h1>

          <p className="mt-2 text-slate-500">
            {
              production.production_name
            }
          </p>

          <div className="mt-3">

            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">

              {reportMode ===
              "full"
                ? "Full Production Report"
                : "Authorized Budget Report"}

            </span>

          </div>

        </div>

        {message && (
          <div className="mb-6 rounded-xl bg-slate-200 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">

              {reportMode ===
              "full"
                ? "Master Budget"
                : "Accessible Budget"}

            </p>

            <p className="mt-2 text-2xl font-bold">

              {money(
                reportBudget ??
                0
              )}

            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Spent
            </p>

            <p className="mt-2 text-2xl font-bold">

              {money(
                totalSpent
              )}

            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Remaining
            </p>

            <p className="mt-2 text-2xl font-bold">

              {money(
                remainingBudget ??
                0
              )}

            </p>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <p className="text-sm text-slate-500">
              Purchases
            </p>

            <p className="mt-2 text-2xl font-bold">
              {
                purchases.length
              }
            </p>

          </div>

        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold">
              Expenditure Summary
            </h2>

            <div className="mt-6 space-y-4">

              {membership
                ?.can_view_props && (
                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Props
                  </span>

                  <span className="font-semibold">

                    {money(
                      propsTotal
                    )}

                  </span>

                </div>
              )}

              {membership
                ?.can_view_stage_management && (
                <div className="flex justify-between">

                  <span className="text-slate-500">
                    Stage Management
                  </span>

                  <span className="font-semibold">

                    {money(
                      stageManagementTotal
                    )}

                  </span>

                </div>
              )}

              <div className="flex justify-between border-t border-slate-200 pt-4">

                <span className="font-medium">
                  Total
                </span>

                <span className="font-bold">

                  {money(
                    totalSpent
                  )}

                </span>

              </div>

            </div>

          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">

            <h2 className="text-lg font-semibold">
              Export
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">

              {reportMode ===
              "full"
                ? "Export the complete production budget workbook."
                : "Export the budget areas and purchases you are authorized to access."}

            </p>

            {reportMode ===
              "scoped" &&
              allocations.length >
                0 && (
                <div className="mt-5 rounded-xl bg-slate-100 p-4">

                  <p className="text-sm font-medium">
                    Accessible Allocations
                  </p>

                  <div className="mt-3 space-y-2">

                    {allocations.map(
                      (
                        allocation
                      ) => (
                        <div
                          key={
                            allocation.id
                          }
                          className="flex justify-between gap-4 text-sm"
                        >

                          <span className="text-slate-600">
                            {
                              allocation.name
                            }
                          </span>

                          <span className="font-medium">

                            {money(
                              Number(
                                allocation.allocated_amount
                              )
                            )}

                          </span>

                        </div>
                      )
                    )}

                  </div>

                </div>
              )}

            <button
              type="button"
              onClick={
                handleExcelExport
              }
              disabled={
                exporting
              }
              className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {exporting
                ? "Creating Excel..."
                : reportMode ===
                    "full"
                  ? "Export Full Workbook"
                  : "Export Authorized Budget Report"}

            </button>

          </div>

        </div>

      </div>

    </main>
  );
}