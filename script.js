/*
 * USPSTF screening recommendation engine
 *
 * This script reads demographic and risk factor information from the form
 * and generates appropriate preventive screening recommendations based on
 * USPSTF guidelines (as of 2025). The recommendations included here are
 * simplified summaries for patient education and do not replace clinical
 * judgement. For each recommendation we include the suggested test,
 * typical interval and a short description. Grades refer to the USPSTF
 * grading scale (A–D, I = insufficient evidence).
 */

// Helper to show or hide smoking intensity fields based on smoking status.
// When the user selects "current" or "former" smoker, we display the
// cigarettes‑per‑day and years‑smoked inputs. For former smokers we also
// display the years‑since‑quitting field. Pack‑years will be computed
// dynamically from these inputs.
document.getElementById('smoking-status').addEventListener('change', function () {
  const status = this.value;
  const cigsGroup = document.getElementById('cigs-group');
  const yearsGroup = document.getElementById('years-smoked-group');
  const quitGroup = document.getElementById('quit-years-group');
  if (status === 'current' || status === 'former') {
    cigsGroup.style.display = 'block';
    yearsGroup.style.display = 'block';
    quitGroup.style.display = status === 'former' ? 'block' : 'none';
  } else {
    cigsGroup.style.display = 'none';
    yearsGroup.style.display = 'none';
    quitGroup.style.display = 'none';
  }
});

// Form submission handler
document.getElementById('screening-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const recommendations = computeRecommendations();
  displayRecommendations(recommendations);
});

// Fetch selected conditions as an array
function getSelectedConditions() {
  const checkboxes = document.querySelectorAll('input[name="conditions"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

function computeRecommendations() {
  const age = parseInt(document.getElementById('age').value, 10);
  const sex = document.getElementById('sex').value; // 'male' or 'female'
  const pregnant = document.getElementById('pregnant').value === 'yes';
  const smokingStatus = document.getElementById('smoking-status').value; // never, current, former
  // Calculate pack‑years from smoking intensity inputs. If the user enters
  // cigarettes per day and years smoked, pack‑years are calculated as
  // (cigarettes per day ÷ 20) × years smoked. If inputs are missing, default
  // to 0. We still capture years since quitting for former smokers.
  const cigsPerDay = parseFloat(document.getElementById('cigs-per-day')?.value) || 0;
  const yearsSmoked = parseFloat(document.getElementById('years-smoked')?.value) || 0;
  const packYears = (cigsPerDay / 20) * yearsSmoked;
  const quitYears = parseFloat(document.getElementById('quit-years')?.value) || 0;
  const conditions = getSelectedConditions();

  const recs = [];

  // Abdominal Aortic Aneurysm (AAA) screening
  // men aged 65-75 who have ever smoked: one‑time abdominal ultrasound (grade B)
  // men aged 65-75 who never smoked: selective (grade C)
  // women: screening not recommended unless risk factors; evidence insufficient
  if (age >= 65 && age <= 75) {
    if (sex === 'male') {
      if (smokingStatus === 'current' || (smokingStatus === 'former' && packYears > 0)) {
        recs.push({
          name: 'Abdominal Aortic Aneurysm',
          test: 'One‑time abdominal ultrasound',
          interval: 'once between ages 65‑75',
          grade: 'B',
          notes: 'Men aged 65–75 with a history of smoking should have a one‑time ultrasound to detect AAA.'
        });
      } else {
        recs.push({
          name: 'Abdominal Aortic Aneurysm',
          test: 'Consider abdominal ultrasound',
          interval: 'once between ages 65‑75',
          grade: 'C',
          notes: 'Men aged 65–75 who have never smoked may discuss AAA screening with their clinician based on risk factors.'
        });
      }
    } else if (sex === 'female' && (smokingStatus !== 'never' || conditions.includes('family-history-aaa'))) {
      recs.push({
        name: 'Abdominal Aortic Aneurysm',
        test: 'Insufficient evidence for screening',
        interval: '',
        grade: 'I',
        notes: 'For women aged 65–75 who have smoked or have a family history of AAA, evidence is insufficient to recommend screening.'
      });
    }
  }

  // Breast cancer screening: women 40–74 biennial mammography (grade B)
  if (sex === 'female' && age >= 40 && age <= 74) {
    recs.push({
      name: 'Breast Cancer',
      test: 'Mammogram',
      interval: 'every 2 years',
      grade: 'B',
      notes: 'Women aged 40–74 should have mammography every 2 years. Begin at age 40; talk to your clinician about earlier screening if high risk.'
    });
  }

  // Cervical cancer screening: women 21–29: cytology every 3 years; 30–65: HPV testing every 5 years, cytology every 3 years or co‑test every 5 years; >65: stop if adequate prior screening and not at high risk
  if (sex === 'female' && !pregnant) {
    if (age >= 21 && age <= 29) {
      recs.push({
        name: 'Cervical Cancer',
        test: 'Pap test (cytology)',
        interval: 'every 3 years',
        grade: 'A',
        notes: 'Women aged 21–29 should undergo cervical cytology (Pap smear) every 3 years. HPV testing alone is not recommended in this age group.'
      });
    } else if (age >= 30 && age <= 65) {
      recs.push({
        name: 'Cervical Cancer',
        test: 'hrHPV testing or Pap/HPV co‑testing',
        interval: 'hrHPV every 5 years, Pap every 3 years, or co‑testing every 5 years',
        grade: 'A',
        notes: 'Women aged 30–65 can choose high‑risk HPV testing every 5 years, Pap smear every 3 years, or combined Pap/HPV every 5 years.'
      });
    } else if (age > 65) {
      recs.push({
        name: 'Cervical Cancer',
        test: 'No routine screening',
        interval: '',
        grade: 'D',
        notes: 'Women older than 65 with adequate prior negative screening and no high‑risk factors do not need routine cervical cancer screening.'
      });
    }
  }

  // Colorectal cancer screening: adults 45–75: regular screening (grade A for 50–75, B for 45–49); selective for 76–85 (C); tests include stool tests, colonoscopy, sigmoidoscopy.
  // Additional recommendation for persons with a first‑degree relative diagnosed with colorectal cancer:
  // start colonoscopy at age 40 (or 10 years earlier than the youngest case) and repeat every 5 years. We
  // approximate using age ≥40 and <45 with the family‑history‑crc flag.
  if (conditions.includes('family-history-crc') && age >= 40 && age < 45) {
    recs.push({
      name: 'Colorectal Cancer (family history)',
      test: 'Colonoscopy',
      interval: 'every 5 years',
      grade: 'B',
      notes: 'People with a first‑degree relative with colorectal cancer should begin colonoscopy at age 40 or 10 years earlier than the youngest case in the family and repeat every 5 years.'
    });
  }
  if (age >= 45 && age <= 75) {
    const grade = age >= 50 ? 'A' : 'B';
    recs.push({
      name: 'Colorectal Cancer',
      test: 'Stool‑based tests (annual FIT or fecal occult blood) or colonoscopy',
      interval: 'FIT annually, FIT‑DNA every 3 years, colonoscopy every 10 years',
      grade: grade,
      notes: 'Adults aged 45–75 should be screened for colorectal cancer. Options include annual fecal immunochemical test (FIT), FIT‑DNA every 3 years, or colonoscopy every 10 years.'
    });
  } else if (age > 75 && age <= 85) {
    recs.push({
      name: 'Colorectal Cancer',
      test: 'Discuss screening',
      interval: '',
      grade: 'C',
      notes: 'Adults aged 76–85 may choose to continue colorectal cancer screening based on overall health and prior screening history.'
    });
  }

  // Lung cancer screening: adults 50–80 with ≥20 pack‑year history who currently smoke or quit within past 15 years (grade B). Stop screening 15 years after quitting or when health conditions preclude treatment.
  if (age >= 50 && age <= 80) {
    const qualifies = (smokingStatus === 'current' && packYears >= 20) ||
                      (smokingStatus === 'former' && packYears >= 20 && quitYears <= 15);
    if (qualifies) {
      recs.push({
        name: 'Lung Cancer',
        test: 'Low‑dose computed tomography (LDCT)',
        interval: 'annually',
        grade: 'B',
        notes: 'Adults aged 50–80 with a ≥20 pack‑year smoking history who currently smoke or quit within the past 15 years should have annual LDCT to screen for lung cancer.'
      });
    }
  }

  // Osteoporosis screening: women ≥65 and younger postmenopausal women with risk factors (grade B); insufficient evidence for men.
  if (sex === 'female') {
    if (age >= 65) {
      recs.push({
        name: 'Osteoporosis',
        test: 'Bone density test (DXA)',
        interval: 'every 2–3 years',
        grade: 'B',
        notes: 'Women aged 65 and older should be screened for osteoporosis using dual‑energy x‑ray absorptiometry (DXA) every 2–3 years.'
      });
    } else if (age < 65 && conditions.includes('osteoporosis-risk')) {
      recs.push({
        name: 'Osteoporosis',
        test: 'Bone density test (DXA)',
        interval: 'every 2–3 years',
        grade: 'B',
        notes: 'Postmenopausal women younger than 65 with risk factors (e.g., early menopause, low weight, corticosteroid use) should be screened for osteoporosis.'
      });
    }
  }

  // Hypertension screening: adults ≥18 (grade A). Suggest annual screening for ≥40 or high‑risk; every 3–5 years for 18–39 with normal blood pressure.
  if (age >= 18) {
    const interval = age >= 40 ? 'every year' : 'every 3–5 years';
    recs.push({
      name: 'High Blood Pressure (Hypertension)',
      test: 'Blood pressure measurement',
      interval: interval,
      grade: 'A',
      notes: 'Adults should have their blood pressure checked regularly in a clinical setting. Adults aged 40+ or at high risk should be screened annually; others every 3–5 years.'
    });
  }

  // Diabetes and prediabetes screening: adults 35–70 who are overweight or obese (grade B). Suggest fasting plasma glucose or HbA1c every 3 years.
  if (age >= 35 && age <= 70 && conditions.includes('overweight')) {
    recs.push({
      name: 'Type 2 Diabetes & Prediabetes',
      test: 'Fasting plasma glucose or HbA1c',
      interval: 'every 3 years',
      grade: 'B',
      notes: 'Adults aged 35–70 with overweight or obesity should be screened for prediabetes and type 2 diabetes every 3 years. Abnormal results should be confirmed on repeat testing.'
    });
  }

  // HIV screening: all adolescents & adults 15–65, and anyone at increased risk; all pregnant persons (grade A).
  if ((age >= 15 && age <= 65) || conditions.includes('hiv-risk') || pregnant) {
    recs.push({
      name: 'HIV',
      test: 'HIV antigen/antibody test',
      interval: 'once; repeat if at continued risk or pregnant',
      grade: 'A',
      notes: 'All persons aged 15–65 and those at high risk (e.g., unprotected sex, injection drug use) should be tested for HIV at least once. Pregnant persons should be screened early in pregnancy.'
    });
  }

  // Hepatitis C screening: adults 18–79 one‑time screening; periodic for continued risk (grade B). Also includes pregnant persons.
  if ((age >= 18 && age <= 79) || conditions.includes('hcv-risk') || pregnant) {
    recs.push({
      name: 'Hepatitis C',
      test: 'HCV antibody with reflex RNA test',
      interval: 'once; repeat for ongoing risk',
      grade: 'B',
      notes: 'Adults aged 18–79 should be screened once for hepatitis C virus. Those with continued risk (e.g., injection drug use) require periodic screening.'
    });
  }

  // Hepatitis B screening: adults at increased risk (grade B). Risk factors: injection drug use, HIV positive, born in high prevalence regions, household contacts of persons with HBV.
  if (conditions.includes('hcv-risk') || conditions.includes('hiv-risk') || pregnant) {
    recs.push({
      name: 'Hepatitis B',
      test: 'HBsAg, anti‑HBs, anti‑HBc',
      interval: 'once; repeat for ongoing risk',
      grade: 'B',
      notes: 'People at increased risk for hepatitis B (e.g., injection drug use, HIV infection, born in high‑prevalence countries) should be screened with surface antigen and antibody tests.'
    });
  }

  // Syphilis screening: pregnant persons (grade A) and non‑pregnant persons at increased risk (grade A)
  if (pregnant || conditions.includes('sti-risk')) {
    recs.push({
      name: 'Syphilis',
      test: 'Serologic testing (treponemal and non‑treponemal tests)',
      interval: pregnant ? 'early in pregnancy, possibly again in third trimester' : 'periodic if at risk',
      grade: 'A',
      notes: pregnant ?
        'All pregnant persons should be screened for syphilis early in pregnancy; repeat testing later in pregnancy may be needed for high‑risk individuals.' :
        'Screen individuals at increased risk for syphilis (e.g., men who have sex with men, persons living with HIV, sex workers) with blood tests.'
    });
  }

  // Chlamydia and Gonorrhea screening: sexually active women ≤24 and older women at risk (grade B); evidence insufficient for men. We approximate risk via sti‑risk.
  if (sex === 'female') {
    if (age >= 15 && age <= 24) {
      recs.push({
        name: 'Chlamydia & Gonorrhea',
        test: 'Vaginal or urine nucleic acid amplification test (NAAT)',
        interval: 'annually',
        grade: 'B',
        notes: 'Sexually active women aged ≤24 should be screened every year for chlamydia and gonorrhea using NAAT.'
      });
    } else if (age > 24 && conditions.includes('sti-risk')) {
      recs.push({
        name: 'Chlamydia & Gonorrhea',
        test: 'Vaginal or urine NAAT',
        interval: 'annually or as indicated by risk',
        grade: 'B',
        notes: 'Women older than 24 who have risk factors for STIs (e.g., new partner, multiple partners, inconsistent condom use) should be screened for chlamydia and gonorrhea.'
      });
    }
  }

  // Latent TB infection screening: adults at increased risk (grade B)
  if (conditions.includes('tb-risk')) {
    recs.push({
      name: 'Latent Tuberculosis Infection',
      test: 'Tuberculin skin test (TST) or interferon‑gamma release assay (IGRA)',
      interval: 'once; repeat for ongoing risk',
      grade: 'B',
      notes: 'People at increased risk of latent TB infection (e.g., born or lived in high‑prevalence countries, residents of homeless shelters or correctional facilities) should be screened.'
    });
  }

  // Unhealthy alcohol use screening: adults ≥18 including pregnant women (grade B). Provide brief counseling or pharmacotherapy if needed.
  if (age >= 18) {
    recs.push({
      name: 'Unhealthy Alcohol Use',
      test: 'Screening questionnaire (e.g., AUDIT‑C)',
      interval: 'as part of routine care',
      grade: 'B',
      notes: 'All adults, including pregnant persons, should be screened for unhealthy alcohol use and offered brief counseling or referral to treatment when appropriate.'
    });
  }

  // Tobacco use counseling: ask all adults about tobacco use (grade A). Provide behavioral interventions and, for non‑pregnant adults, FDA‑approved medications.
  if (age >= 18) {
    recs.push({
      name: 'Tobacco Use',
      test: 'Ask about tobacco use and provide cessation support',
      interval: 'at each visit',
      grade: 'A',
      notes: pregnant ?
        'Pregnant persons who use tobacco should receive behavioral counseling. Medications are not recommended during pregnancy.' :
        'All adults should be asked about tobacco use and offered behavioral counseling and FDA‑approved medications to quit.'
    });
  }

  return recs;
}

function displayRecommendations(recs) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  const heading = document.createElement('h2');
  if (recs.length === 0) {
    heading.textContent = 'No specific USPSTF recommendations based on the information provided.';
    resultsDiv.appendChild(heading);
    return;
  }
  heading.textContent = 'Recommended screenings:';
  resultsDiv.appendChild(heading);

  recs.forEach(rec => {
    const div = document.createElement('div');
    div.className = 'recommendation';
    const title = document.createElement('h3');
    title.textContent = `${rec.name} (Grade ${rec.grade})`;
    div.appendChild(title);
    const test = document.createElement('p');
    test.innerHTML = `<strong>Test:</strong> ${rec.test}`;
    div.appendChild(test);
    if (rec.interval) {
      const interval = document.createElement('p');
      interval.innerHTML = `<strong>Interval:</strong> ${rec.interval}`;
      div.appendChild(interval);
    }
    const notes = document.createElement('p');
    notes.innerHTML = `<strong>Notes:</strong> ${rec.notes}`;
    div.appendChild(notes);
    resultsDiv.appendChild(div);
  });
}