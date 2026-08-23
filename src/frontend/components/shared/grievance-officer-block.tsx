import {
  grievanceOfficer,
  LEGAL_CONTACTS,
  GRIEVANCE_ACKNOWLEDGEMENT_HOURS,
  GRIEVANCE_RESOLUTION_DAYS,
} from '@/shared/data/legal-entity';

/**
 * The grievance route, rendered identically in the privacy policy and the
 * terms. Previously duplicated in both files as bracketed placeholders that
 * shipped to customers.
 *
 * When no officer is appointed this deliberately does not print `[Name]`. It
 * says what is true — the appointment is pending, here is where complaints go
 * in the meantime — which is both more honest and less damaging than exposing
 * an unfilled template. `checkEnvironment` warns at boot so this state is
 * noticed rather than shipped by accident.
 */
export function GrievanceOfficerBlock() {
  const officer = grievanceOfficer();

  return (
    <div>
      <h3 className="font-bold text-zinc-950 text-xs mb-1">Grievance Officer:</h3>

      {officer ? (
        <ul className="list-none space-y-1 text-zinc-600 pl-0">
          <li>{officer.name}</li>
          <li>{officer.designation}</li>
          <li>
            Email:{' '}
            <a
              href={`mailto:${officer.email}`}
              className="text-[#A77F3A] hover:underline font-bold"
            >
              {officer.email}
            </a>
          </li>
          {officer.address ? <li>{officer.address}</li> : null}
        </ul>
      ) : (
        <p className="text-zinc-600">
          A named Grievance Officer is being appointed. Until that appointment is published,
          send complaints to{' '}
          <a
            href={`mailto:${LEGAL_CONTACTS.support}`}
            className="text-[#A77F3A] hover:underline font-bold"
          >
            {LEGAL_CONTACTS.support}
          </a>{' '}
          and they will be handled to the same timelines below.
        </p>
      )}

      <p className="text-zinc-600 mt-2">
        We acknowledge complaints within {GRIEVANCE_ACKNOWLEDGEMENT_HOURS} hours and aim to
        resolve them within {GRIEVANCE_RESOLUTION_DAYS} days of receipt.
      </p>
    </div>
  );
}
