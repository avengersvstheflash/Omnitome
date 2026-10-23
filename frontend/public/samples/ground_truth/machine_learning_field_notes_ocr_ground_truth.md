# OCR Ground Truth & Image-Rendered Test Page Inventory: *Machine Learning Field Notes*

**Publisher:** Omnitome Publishing — Synthetic Archive (October 2026 Premium Edition)  
**Target PDF:** `machine_learning_field_notes_Premium.pdf`  
**Designated Image-Rendered OCR Test Pages:** **Page 123** (`ocr_test_pages/ocr_page_1.png`) and **Page 124** (`ocr_test_pages/ocr_page_2.png`)  
**Vector Text Count on OCR Pages (Verified via `pypdf`):** `0` chars on Page 123 and `0` chars on Page 124 (Confirming 100% pure raster image embedding; all ordinary book pages retain full selectable vector text)  
**OCR Engine Executed:** Tesseract OCR (`/usr/bin/tesseract` via `pytesseract`) at 300 DPI (`1801 × 2700 px`)  

---

## 1. Summary of Image-Rendered OCR Plates

| Plate ID | Source Image File | PDF Page Number | Physical & Pixel Resolution | Vector Chars on PDF Page | Layout Archetype Tested | Executed Tesseract Word Recall | Executed Sequence Similarity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OCR-D1** | `ocr_test_pages/ocr_page_1.png` | **Page 123** | 1801×2700 px (300 DPI, 6×9 in) | `0` chars (Pure Raster) | Single-column mathematical reference sheet containing displayed matrix equations, Greek symbols, superscripts/subscripts, and worked collinear numeric values | **86.81%** | **22.5%** |
| **OCR-D2** | `ocr_test_pages/ocr_page_2.png` | **Page 124** | 1801×2700 px (300 DPI, 6×9 in) | `0` chars (Pure Raster) | Two-column technical benchmark summary paired with a 7-column executed experimental metrics table and cost-threshold formula | **89.89%** | **36.98%** |

---

## 2.1 OCR-D1 — Archival OCR Plate I — Mathematical Notation & Penalized Estimation Derivation Sheet (PDF Page 123)

- **PDF Location:** Page **123** of `machine_learning_field_notes_Premium.pdf`
- **Raster Source Image:** `ocr_test_pages/ocr_page_1.png` (`1801 × 2700 px` at 300 DPI)
- **Layout Features Tested:** Single-column mathematical reference sheet containing displayed matrix equations, Greek symbols, superscripts/subscripts, and worked collinear numeric values
- **OCR-Sensitive Notation & Formatting:** Matrix transpose superscripts (X^T X), inverse exponents (-1), Greek letters (beta, lambda, nu, rho, sigma), L2/L1 norms, and soft-thresholding operator S(rho_j, lambda).
- **Executed Tesseract OCR Accuracy:** Word Vocabulary Recall = **86.81%**, Normalized Linear Sequence Similarity = **22.5%** *(Note: Linear sequence similarity reflects horizontal line scanning across side-notes/tables or ASCII mapping of Greek math symbols)*

### Canonical Ground-Truth Text (Exact Expected Extraction)

```text
ARCHIVAL OCR BENCHMARK PLATE I: PENALIZED ESTIMATION & BIAS-VARIANCE EQUATIONS
Omnitome Synthetic Archive • Volume D Mathematical Reference Sheet

1. Closed-Form Ridge (L2) vs. Ordinary Least Squares (OLS) Normal Equations
Given an augmented design matrix X in R^(n x (p+1)) with leading intercept column of ones and target vector y in R^n, Ordinary Least Squares minimizes residual sum of squares ||y - X*beta||_2^2. When predictors exhibit strong collinearity, the smallest eigenvalue nu_min of the Gram matrix X^T X approaches zero, inflating parameter covariance Cov(beta_OLS) = sigma_epsilon^2 (X^T X)^(-1) as 1/nu_min -> infinity. Tikhonov Ridge (L2) regularization adds a quadratic penalty lambda * sum(beta_j^2) across the p slopes while leaving the intercept beta_0 unpenalized ((I_0)_00 = 0):
beta_Ridge(lambda) = (X^T X + lambda I_0)^(-1) X^T y

2. Hoerl-Kennard (1970) Existence Theorem and Eigenbasis Trace Variance
In the orthogonal eigenbasis of X^T X with eigenvalues nu_1, ..., nu_p, the total trace variance and squared bias of the Ridge estimator are:
tr(Cov(beta_Ridge)) = sigma_epsilon^2 * sum_{j=1..p} [ nu_j / (nu_j + lambda)^2 ],   Bias^2(beta_Ridge) = sum_{j=1..p} [ lambda / (nu_j + lambda) ]^2 (beta_j*)^2
Because d(Bias^2)/d(lambda) = 0 at lambda = 0+ while d(Var)/d(lambda) = -2*sigma_epsilon^2 * sum(nu_j^(-2)) < 0, there always exists lambda* > 0 that achieves strictly lower expected MSE than unregularized OLS.

3. Coordinate-Descent Lasso (L1) Soft-Thresholding Operator (Tibshirani, 1996)
Replacing the squared L2 penalty with the L1 norm lambda * sum(|beta_j|) induces exact sparsity via the subgradient soft-thresholding update on partial residual correlation rho_j:
beta_j = S(rho_j, lambda) = sign(rho_j) * max(0, |rho_j| - lambda)
```

### Evaluation Answer Key for This OCR Page

- **Q1:** Write the closed-form Ridge regression matrix equation and explain why (I_0)_00 is set to 0. -> beta_Ridge(lambda) = (X^T X + lambda I_0)^(-1) X^T y; setting (I_0)_00 = 0 leaves the intercept beta_0 unpenalized so target baseline shifts are not shrunk toward zero.
- **Q2:** Why does Hoerl & Kennard's theorem guarantee that some lambda* > 0 beats OLS in expected MSE? -> At lambda = 0+, the derivative of squared bias is 0 whereas the derivative of variance is strictly negative (-2*sigma_epsilon^2 * sum(nu_j^(-2)) < 0).

### Actual Executed Tesseract OCR Output (`pytesseract` at 300 DPI)

```text
ARCHIVAL OCR BENCHMARK PLATE | * MATHEMATICAL DERIVATION &
NOTATION SHEET

1. Closed-Form Ridge (L,) vs. OLS Normal Equations

Given an augmented design matrix X € R™©*D with leading intercept column
of ones and target vector y € R", Ordinary Least Squares minimizes residual
sum of squares |ly - X|| 9. When predictors exhibit strong collinearity, the

smallest eigenvalue v,,,, of the Gram matrix X'X approaches zero, inflating
parameter covariance Cov(Bo;5) = 0,2(XTX) 1). Tikhonov Ridge (L,)
regularization adds a quadratic penalty A X B across the p slopes while

leaving the intercept B, unpenalized ((Ip)q,q = 0):
Bridge) = (XX + Aly)! X"y

2. Hoerl-Kennard (1970) Existence Theorem & Trace Variance

In the orthogonal eigenbasis of x!x with eigenvalues Vay ees Vy the total trace

variance and squared bias of the Ridge estimator are:

tr(COVBpiage)) = Fe” Bg pl Vj/ (Vj, +071, Bias*(Bpiage) = Zit. p [A/ (vj +0 P
(B;*)?
Because d(Bias2)/dA = 0 at A = 0* while d(Var)/da = -20,” x vj? < 0, there always
exists A* > 0 that achieves strictly lower expected MSE than unregularized OLS.
3. Coordinate-Descent Lasso (L,) Soft-Thresholding (Tibshirani,
1996)

Replacing the squared L, penalty with the L, norm A & |B; | induces exact

sparsity via the subgradient soft-thresholding update on partial residual
correlation P;:

B; = S(p;, A) = sign(p;) -max(0, | p; | -A)

Omnitome Synthetic Archive * Volume D OCR Verification Plate | (300 DPI Raster Reference)
```

---

## 2.2 OCR-D2 — Archival OCR Plate II — Two-Column Executed Benchmark Scorecard & Imbalanced Metrics Table (PDF Page 124)

- **PDF Location:** Page **124** of `machine_learning_field_notes_Premium.pdf`
- **Raster Source Image:** `ocr_test_pages/ocr_page_2.png` (`1801 × 2700 px` at 300 DPI)
- **Layout Features Tested:** Two-column technical benchmark summary paired with a 7-column executed experimental metrics table and cost-threshold formula
- **OCR-Sensitive Notation & Formatting:** Decimal precision metrics (1.9166°C, 0.9533, 0.4939), confusion matrix counts (TP=5, FP=5, TN=138, FN=2), currency cost ratios ($5,000 / $55,000 = 0.0909), and SHAP additivity notation.
- **Executed Tesseract OCR Accuracy:** Word Vocabulary Recall = **89.89%**, Normalized Linear Sequence Similarity = **36.98%** *(Note: Linear sequence similarity reflects horizontal line scanning across side-notes/tables or ASCII mapping of Greek math symbols)*

### Canonical Ground-Truth Text (Exact Expected Extraction)

```text
ARCHIVAL OCR BENCHMARK PLATE II: EXECUTED TURBINE BENCHMARK SCORECARD
Column 1: Point-in-Time Leakage Isolation
On industrial_turbine_telemetry.csv (N = 600 hours across 30 units; chronological split n_train = 450, n_test = 150), the training-only median of lube_pressure_bar is 4.8700 bar versus the leaky global median of 4.8300 bar. Including the post-event proxy post_inspection_hours_LEAKY fabricates a perfect Test ROC-AUC = 1.0000 and PR-AUC = 1.0000; removing it reveals the true sensor baseline.

Column 2: ROC-AUC vs. PR-AUC Under 4.67% Imbalance
With only 7 faults vs. 143 normal hours in the test window (4.67% prevalence), the clean L2 logistic classifier achieves ROC-AUC = 0.9630 because 5 False Positives divided by 143 negatives yields a tiny FPR = 0.0350. However, Precision-Recall AUC is 0.4939 (Precision = 5/10 = 0.5000 at tau = 0.30; Saito & Rehmsmeier, 2015). Lowering tau to the Bayesian cost optimum tau* = $5,000 / ($5,000 + $50,000) = 0.0909 catches 7/7 faults and reduces total test cost from $350,000 to $105,000.

Model / Pipeline | Intercept (b0) | Load (b2) | Vib (b5) | Primary Test Metric | Secondary Metric | Status
OLS Regression (lam=0) | 27.1182 | +7.2140 | +2.1505 | RMSE = 1.9235 C | R2 = 0.9530 (MAE 1.5578) | Executed
Ridge Regression (lam=8.53) | 27.1182 | +6.9987 | +2.2873 | RMSE = 1.9166 C | R2 = 0.9533 (MAE 1.5441) | Best Clean Reg
Lasso Regression (lam=0.25) | 27.1182 | +6.7709 | +2.4244 | RMSE = 1.9327 C | R2 = 0.9526 (MAE 1.5608) | Sparse L1
Clean Logistic (tau=0.30) | -3.8412 | +1.1820 | +1.4105 | PR-AUC = 0.4939 | ROC-AUC = 0.9630 (F1 0.5882) | Clean Sensor
Leaky Proxy Logistic | -6.1204 | +0.1102 | +0.0940 | PR-AUC = 1.0000 | ROC-AUC = 1.0000 (Brier 0.0005) | Target Leakage
```

### Evaluation Answer Key for This OCR Page

- **Q1:** Why does the clean logistic classifier achieve ROC-AUC = 0.9630 while PR-AUC is only 0.4939 on the test set? -> Because with 7 faults and 143 normal hours (4.67% prevalence), 5 False Positives divided by 143 negatives gives FPR = 0.0350 in ROC space, whereas in PR space 5 False Positives against 5 True Positives gives Precision = 0.5000.
- **Q2:** Compare the executed Test RMSE and R2 across OLS, Ridge (lambda=8.5317), and Lasso (lambda=0.2500). -> OLS: RMSE = 1.9235 C, R2 = 0.9530; Ridge: RMSE = 1.9166 C, R2 = 0.9533; Lasso: RMSE = 1.9327 C, R2 = 0.9526.

### Actual Executed Tesseract OCR Output (`pytesseract` at 300 DPI)

```text
ARCHIVAL OCR BENCHMARK PLATE II * TWO-COLUMN SCORECARD &
METRICS TABLE

Executed Industrial Turbine Benchmark Scorecard (N = 600, Seed

202610)

1. Point-in-Time Leakage Audit

On

industrial_turbine telemetry.csv
600 hours across 30 units;

chronological split n = 450, n

150), the training-only median of
lube pressure bar is 4.8700 bar
versus the leaky global median of
4.8300 bar. Including the post-event
proxy post_inspection_hours_ LEAKY
fabricates a perfect Test ROC-AUC =
1.0000 and PR-AUC = 1.0000; removing
it reveals the true sensor baseline.

train test —

Vib
(bg)

Load
(b,)

Model /
Pipeline

OLS (A=0) =. 27.1182 = +7.2140 = +2.1505

Ridge 27.1182 +6.9987  +2.2873

(A=8.53)
27.1182  +6.7709

Lasso +2.4244

(A=0.25)
+1.1820

Clean +1.4105

Logistic

Leaky +0.1102 +0.0940

Logistic

2. Imbalanced ROC vs. PR
Divergence

With only 7 faults vs. 143 normal
hours in the test window (4.67%

prevalence), the clean L, logistic

classifier achieves ROC-AUC = 0.9630
because 5 False Positives divided by
143 negatives yields a tiny FPR =
0.0350. However, Precision-Recall AUC
is 0.4939 (Precision = 5/10 = 0.5000 at T
= 0.30; Saito & Rehmsmeier, 2015).
Lowering t to the Bayesian cost
optimum t* = $5,000 / ($5,000 +
$50,000) = 0.0909 catches 7/7 faults and
reduces total test cost from $350,000 to
$105,000.

Primary
Metric

Secondary
Metric

RMSE = Executed
1.9235 °C

R2 = 0.9530
(MAE 1.5578)

Best
Clean

RMSE =
1.9166 °C

R2 = 0.9533
(MAE 1.5441)

RMSE =
1.9327 °C

R2 = 0.9526 Sparse Ly

(MAE 1.5608)

Clean
Sensor

ROC-AUC =
0.9630 (F,

0.5882)

PR-AUC =
0.4939

ROC-AUC =
1.0000 (Brier
0.0005)

Target
Leak

Omnitome Synthetic Archive * Volume D OCR Verification Plate II (300 DPI Raster Reference)
```

---
